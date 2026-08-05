import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Recommended audit log table for PostgreSQL.
 * Re-export from your app schema, then run drizzle-kit generate/migrate:
 * ```ts
 * // server/db/schema.ts (or postgresql.ts)
 * export { auditLogs } from '#layers/autoadmin/server/db/auditLog.postgresql'
 * ```
 */
export const auditLogs = pgTable('autoadmin_audit_logs', {
  id: serial().primaryKey(),
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  action: text().notNull(),
  modelKey: text().notNull(),
  lookupValue: text(),
  actorId: text(),
  actorRole: text(),
  actorLabel: text(),
  changes: jsonb().$type<{ before?: Record<string, unknown>, after?: Record<string, unknown> }>(),
  meta: jsonb().$type<Record<string, unknown>>(),
})
