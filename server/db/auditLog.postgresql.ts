import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * AutoAdmin-owned audit log table (PostgreSQL).
 * Used automatically by `configureAudit({ enabled: true })`. Created on first
 * successful insert path when missing (insert-then-ensure). No app schema re-export needed.
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
