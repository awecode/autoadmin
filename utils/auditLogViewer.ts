import { toTitleCase } from '#layers/autoadmin/utils/string'

/** Format a single audit payload value for display. */
export function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '—'
  }
  if (typeof value === 'string') {
    return value || '—'
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

export interface AuditChangesPayload {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export interface AuditLogEntry {
  id?: number | string
  action: string
  modelKey: string
  lookupValue?: string | null
  actorId?: string | null
  actorRole?: string | null
  actorLabel?: string | null
  createdAt?: string | Date | number | null
  changes?: AuditChangesPayload | null
  meta?: Record<string, unknown> | null
}

export function isAuditLogEntry(row: Record<string, unknown> | null | undefined): row is AuditLogEntry & Record<string, unknown> {
  if (!row || typeof row !== 'object') {
    return false
  }
  return typeof row.action === 'string' && typeof row.modelKey === 'string'
}

/** Union of keys from before/after for field-level diff tables. */
export function auditChangeFieldKeys(changes: AuditChangesPayload | null | undefined): string[] {
  if (!changes) {
    return []
  }
  const keys = new Set([
    ...Object.keys(changes.before ?? {}),
    ...Object.keys(changes.after ?? {}),
  ])
  return Array.from(keys).sort()
}

/** Prefer the registered admin label when present in drizzle meta links. */
export function labelForModelKey(
  modelKey: string,
  drizzleLinks?: Array<{ label: string, to: { params?: { modelKey?: string } | Record<string, string> } }>,
): string {
  const fromMeta = drizzleLinks?.find((link) => {
    const params = link.to.params
    return !!params && 'modelKey' in params && params.modelKey === modelKey
  })?.label
  if (fromMeta) {
    return fromMeta
  }
  return toTitleCase(modelKey.replace(/-/g, ' '))
}
