import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Recommended audit log table for SQLite.
 * Re-export from your app schema, then run drizzle-kit generate/migrate:
 * ```ts
 * // server/db/schema.ts (or sqlite.ts)
 * export { auditLogs } from '#layers/autoadmin/server/db/auditLog.sqlite'
 * ```
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
