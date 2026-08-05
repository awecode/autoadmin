import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * AutoAdmin-owned audit log table (SQLite / libsql / D1).
 * Used automatically by `configureAudit({ enabled: true })`. Created on first
 * successful insert path when missing (insert-then-ensure). No app schema re-export needed.
 */
export const auditLogs = sqliteTable('autoadmin_audit_logs', {
  id: integer().primaryKey({ autoIncrement: true }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch()*1000)`),
  action: text().notNull(),
  modelKey: text().notNull(),
  lookupValue: text(),
  actorId: text(),
  actorRole: text(),
  actorLabel: text(),
  changes: text({ mode: 'json' }).$type<{ before?: Record<string, unknown>, after?: Record<string, unknown> }>(),
  meta: text({ mode: 'json' }).$type<Record<string, unknown>>(),
})
