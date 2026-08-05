import type { AuditActor } from '#autoadmin/roleAccess'
import type { Table } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getAuditActorFromEvent } from '#autoadmin/roleAccess'
import { getTableName, sql } from 'drizzle-orm'
import { auditLogs as postgresqlAuditLogs } from '../db/auditLog.postgresql'
import { auditLogs as sqliteAuditLogs } from '../db/auditLog.sqlite'
import { useAdminDb } from './db'
import { getConfiguredAdminDialect } from './dialect'

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
  /**
   * When true, audit all registered models unless a model sets `audit: false`
   * (or `{ enabled: false }`). Per-model `audit: true` / options still work when
   * this is false or omitted.
   */
  enabled?: boolean
  /**
   * Audit table used for inserts and the admin UI.
   * When omitted (and no custom `write`), AutoAdmin uses its shipped dialect table.
   */
  table?: Table
  /** When set, replaces the default table insert. */
  write?: (entry: AuditEntry) => Promise<void> | void
  getActor?: (event: H3Event) => AuditActor | undefined
  excludeFields?: string[]
}

const OWNED_AUDIT_TABLE_NAME = 'autoadmin_audit_logs'

const SQLITE_CREATE_AUDIT_TABLE = `CREATE TABLE IF NOT EXISTS \`autoadmin_audit_logs\` (
\t\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`created_at\` integer DEFAULT (unixepoch()*1000) NOT NULL,
\t\`action\` text NOT NULL,
\t\`model_key\` text NOT NULL,
\t\`lookup_value\` text,
\t\`actor_id\` text,
\t\`actor_role\` text,
\t\`actor_label\` text,
\t\`changes\` text,
\t\`meta\` text
)`

const POSTGRES_CREATE_AUDIT_TABLE = `CREATE TABLE IF NOT EXISTS "autoadmin_audit_logs" (
\t"id" serial PRIMARY KEY NOT NULL,
\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,
\t"action" text NOT NULL,
\t"model_key" text NOT NULL,
\t"lookup_value" text,
\t"actor_id" text,
\t"actor_role" text,
\t"actor_label" text,
\t"changes" jsonb,
\t"meta" jsonb
)`

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

/** Shipped audit table for the configured admin dialect (sqlite covers D1/libsql). */
export function resolveDefaultAuditTable(): Table {
  try {
    const dialect = getConfiguredAdminDialect(useRuntimeConfig())
    if (dialect === 'postgresql') {
      return postgresqlAuditLogs
    }
  }
  catch {
    // Outside Nitro (e.g. unit tests): default to sqlite table.
  }
  return sqliteAuditLogs
}

export function isOwnedAuditTable(table: Table | undefined): boolean {
  if (!table) {
    return false
  }
  return getTableName(table) === OWNED_AUDIT_TABLE_NAME
}

/**
 * Configure the audit sink. When neither `table` nor `write` is set, uses the
 * shipped dialect table so callers only need `configureAudit({ enabled: true })`.
 * Passing `{}` clears config without resolving a default table.
 */
export function configureAudit(config: AuditGlobalConfig): void {
  const next: AuditGlobalConfig = { ...config }
  if (!next.write && !next.table && Object.keys(config).length > 0) {
    next.table = resolveDefaultAuditTable()
  }
  getAuditState().config = next
}

export function getAuditConfig(): AuditGlobalConfig {
  return getAuditState().config
}

/**
 * Whether auditing is on for a model: explicit per-model setting wins;
 * otherwise falls back to `configureAudit({ enabled: true })`.
 */
export function isModelAuditEnabled(audit: AuditModelConfig | undefined): boolean {
  if (audit === false) {
    return false
  }
  if (audit === true) {
    return true
  }
  if (audit && typeof audit === 'object') {
    return audit.enabled !== false
  }
  return getAuditConfig().enabled === true
}

export function resolveModelAuditOptions(audit: AuditModelConfig | undefined): AuditModelOptions | undefined {
  if (audit === true) {
    return { enabled: true }
  }
  if (audit === false) {
    return { enabled: false }
  }
  if (audit && typeof audit === 'object') {
    return { enabled: audit.enabled !== false, ...audit }
  }
  if (getAuditConfig().enabled === true) {
    return { enabled: true }
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

/** Stable equality for sanitized audit payloads (key order independent). */
export function auditRecordsEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b) {
    return false
  }
  return stableStringify(a) === stableStringify(b)
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = obj[key]
        return acc
      }, {} as Record<string, unknown>)
    }
    return v
  })
}

/** True when the driver error indicates the audit table is missing. */
export function isMissingTableError(error: unknown): boolean {
  const err = error as { code?: string, message?: string, cause?: { code?: string, message?: string } } | null
  const code = String(err?.code ?? err?.cause?.code ?? '')
  if (code === '42P01') {
    return true
  }
  const msg = `${err?.message ?? ''} ${err?.cause?.message ?? ''} ${String(error)}`.toLowerCase()
  if (msg.includes('no such table')) {
    return true
  }
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return true
  }
  return false
}

async function execAuditDdl(ddl: string): Promise<void> {
  const db = await useAdminDb() as {
    run?: (query: unknown) => Promise<unknown>
    execute?: (query: unknown) => Promise<unknown>
  }
  const dialect = getConfiguredAdminDialect(useRuntimeConfig())
  const query = sql.raw(ddl)
  if (dialect === 'postgresql') {
    if (typeof db.execute !== 'function') {
      throw new Error('[autoadmin] PostgreSQL audit DDL requires db.execute')
    }
    await db.execute(query)
    return
  }
  if (typeof db.run === 'function') {
    await db.run(query)
    return
  }
  if (typeof db.execute === 'function') {
    await db.execute(query)
    return
  }
  throw new Error('[autoadmin] Database driver does not support raw DDL for audit table ensure')
}

async function ensureOwnedAuditTable(): Promise<void> {
  const dialect = getConfiguredAdminDialect(useRuntimeConfig())
  const ddl = dialect === 'postgresql' ? POSTGRES_CREATE_AUDIT_TABLE : SQLITE_CREATE_AUDIT_TABLE
  await execAuditDdl(ddl)
}

/**
 * Run a DB operation against the owned audit table. On "table missing", create it
 * and retry once (same path as audit inserts). No-op for other tables.
 */
export async function withOwnedAuditTableRetry<T>(
  table: Table | undefined,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run()
  }
  catch (error) {
    if (!isOwnedAuditTable(table) || !isMissingTableError(error)) {
      throw error
    }
    await ensureOwnedAuditTable()
    return await run()
  }
}

function toAuditRow(entry: AuditEntry) {
  return {
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
}

/**
 * Insert into the audit table. For AutoAdmin's owned table, on "missing table"
 * create it and retry the insert once. Custom tables are insert-only.
 */
async function defaultTableWrite(entry: AuditEntry, table: Table): Promise<void> {
  const db = await useAdminDb()
  const row = toAuditRow(entry)
  try {
    await db.insert(table).values(row)
  }
  catch (error) {
    if (!isOwnedAuditTable(table) || !isMissingTableError(error)) {
      throw error
    }
    await ensureOwnedAuditTable()
    await db.insert(table).values(row)
  }
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
