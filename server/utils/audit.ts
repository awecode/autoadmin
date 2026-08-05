import type { AuditActor } from '#autoadmin/roleAccess'
import type { Table } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getAuditActorFromEvent } from '#autoadmin/roleAccess'
import { useAdminDb } from './db'

export type AuditAction
  = | 'create'
    | 'update'
    | 'delete'
    | 'bulkDelete'
    | 'relation.m2m'
    | 'relation.o2m'

export interface AuditChanges {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export interface AuditEntry {
  action: AuditAction
  modelKey: string
  lookupValue?: string | number
  actor?: AuditActor
  timestamp: Date
  changes?: AuditChanges
  meta?: Record<string, unknown>
}

export interface AuditModelOptions {
  enabled?: boolean
  excludeFields?: string[]
  includeFields?: string[]
}

export type AuditModelConfig = boolean | AuditModelOptions

export interface AuditGlobalConfig {
  /** User-owned audit table (from shipped schema or compatible columns). */
  table?: Table
  /** When set, replaces the default table insert. */
  write?: (entry: AuditEntry) => Promise<void> | void
  getActor?: (event: H3Event) => AuditActor | undefined
  excludeFields?: string[]
}

interface AuditRuntimeState {
  config: AuditGlobalConfig
}

function getAuditState(): AuditRuntimeState {
  const g = globalThis as typeof globalThis & { __autoadminAudit?: AuditRuntimeState }
  if (!g.__autoadminAudit) {
    g.__autoadminAudit = { config: {} }
  }
  return g.__autoadminAudit
}

export function configureAudit(config: AuditGlobalConfig): void {
  getAuditState().config = { ...config }
}

export function getAuditConfig(): AuditGlobalConfig {
  return getAuditState().config
}

export function isModelAuditEnabled(audit: AuditModelConfig | undefined): boolean {
  if (audit === true) {
    return true
  }
  if (audit && typeof audit === 'object' && audit.enabled !== false) {
    return true
  }
  return false
}

export function resolveModelAuditOptions(audit: AuditModelConfig | undefined): AuditModelOptions | undefined {
  if (audit === true) {
    return { enabled: true }
  }
  if (audit && typeof audit === 'object') {
    return { enabled: audit.enabled !== false, ...audit }
  }
  return undefined
}

function jsonSafeClone(value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }
  try {
    return JSON.parse(JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') {
        return v.toString()
      }
      if (v instanceof Date) {
        return v.toISOString()
      }
      return v
    }))
  }
  catch {
    return String(value)
  }
}

/**
 * Filter record fields for audit payloads using include/exclude lists.
 * `includeFields` wins when set; otherwise `excludeFields` (model + global) are stripped.
 */
export function sanitizeAuditRecord(
  record: Record<string, unknown> | null | undefined,
  options?: {
    excludeFields?: string[]
    includeFields?: string[]
    globalExcludeFields?: string[]
  },
): Record<string, unknown> | undefined {
  if (!record || typeof record !== 'object') {
    return undefined
  }
  const include = options?.includeFields
  const exclude = new Set([
    ...(options?.globalExcludeFields ?? []),
    ...(options?.excludeFields ?? []),
  ])

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (include?.length) {
      if (!include.includes(key)) {
        continue
      }
    }
    else if (exclude.has(key)) {
      continue
    }
    out[key] = jsonSafeClone(value)
  }
  return out
}

async function defaultTableWrite(entry: AuditEntry, table: Table): Promise<void> {
  const db = await useAdminDb()
  const row = {
    action: entry.action,
    modelKey: entry.modelKey,
    lookupValue: entry.lookupValue != null ? String(entry.lookupValue) : null,
    actorId: entry.actor?.id != null ? String(entry.actor.id) : null,
    actorRole: entry.actor?.role ?? null,
    actorLabel: entry.actor?.label ?? null,
    changes: entry.changes ?? null,
    meta: entry.meta ?? null,
    createdAt: entry.timestamp,
  }
  await db.insert(table).values(row)
}

/**
 * Persist an audit entry. Best-effort: failures are logged and never thrown to callers.
 */
export async function emitAuditEvent(
  entryInput: Omit<AuditEntry, 'timestamp' | 'actor'> & {
    timestamp?: Date
    actor?: AuditActor
    event?: H3Event
  },
): Promise<void> {
  const config = getAuditConfig()
  if (!config.write && !config.table) {
    return
  }

  try {
    const getActor = config.getActor ?? getAuditActorFromEvent
    const actor = entryInput.actor ?? (entryInput.event ? getActor(entryInput.event) : undefined)
    const entry: AuditEntry = {
      action: entryInput.action,
      modelKey: entryInput.modelKey,
      lookupValue: entryInput.lookupValue,
      actor,
      timestamp: entryInput.timestamp ?? new Date(),
      changes: entryInput.changes,
      meta: entryInput.meta,
    }

    if (config.write) {
      await config.write(entry)
      return
    }

    if (config.table) {
      await defaultTableWrite(entry, config.table)
    }
  }
  catch (error) {
    console.error('[autoadmin] Failed to write audit log entry:', error)
  }
}
