# Audit Logs

Opt-in activity logging for Drizzle admin writes (create, update, delete, bulk delete, and m2m/o2m relation changes). Entries follow a proven activity-log shape: action, subject (`modelKey` + `lookupValue`), actor, `changes` JSON, optional `meta`, and timestamp.

JSON admin is not audited in this version.

## 1. Add the audit table to your schema

Re-export the dialect-specific table from your app schema so drizzle-kit can migrate it (same pattern as your other tables).

**SQLite / libsql / D1:**

```ts
// server/db/schema.ts (or sqlite.ts)
// Nuxt resolves `#layers/autoadmin` at runtime. For drizzle-kit, prefer a relative
// path into the layer (or configure the same alias in drizzle.config).
export { auditLogs } from '#layers/autoadmin/server/db/auditLog.sqlite'
// e.g. export { auditLogs } from '../../../layers/autoadmin/server/db/auditLog.sqlite'
```

**PostgreSQL:**

```ts
export { auditLogs } from '#layers/autoadmin/server/db/auditLog.postgresql'
```

Columns: `id`, `createdAt`, `action`, `modelKey`, `lookupValue`, `actorId`, `actorRole`, `actorLabel`, `changes`, `meta`.

## 2. Enable auditing (one call)

In your Nitro admin plugin, pass the table once. That configures the writer and registers the list/view admin UI (create/update/delete stay disabled).

```ts
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { auditLogs, posts, users } from '~~/server/db/schema'

export default defineNitroPlugin(() => {
  const registry = useAdminRegistry()

  registry.configureAudit({
    table: auditLogs,
    // Audit every registered model (opt out per model with audit: false)
    enabled: true,
    // Optional: strip sensitive fields from all models
    // excludeFields: ['passwordHash'],
    // Optional UI overrides (roles, label, list, …). Omit for defaults.
    // ui: { roles: ['admin'] },
    // Headless (sink only, no admin page):
    // ui: false,
  })

  registry.register(posts)
  // Opt out one model, or pass field lists without enabling globally:
  // registry.register(users, { audit: false })
  // registry.register(posts, { audit: { excludeFields: ['content'] } })
})
```

- Without `configureAudit({ table })` or a custom `write`, emits are no-ops.
- Set `enabled: true` to audit all models by default, or set `audit: true` / options on individual models.
- Use `audit: false` (or `{ enabled: false }`) to opt a model out when global enable is on.
- If both `table` and `write` are set, **`write` replaces** the default table insert.

### Custom sink

```ts
registry.configureAudit({
  write: async (entry) => {
    // send to your logger, queue, etc.
    console.info(entry)
  },
  enabled: true,
  // no table → no admin UI
})
```

## 3. Actor identity

By default, `getAuditActorFromEvent` reads `event.context.auth.user` (`id`, `role`, `email` / `name`). Override it via `#autoadmin/roleAccess` (same alias as role helpers), or pass `getActor` to `configureAudit`.

## 4. What is logged

| Action | Payload |
|--------|---------|
| `create` | `changes.after` |
| `update` | `changes.before` + `changes.after` |
| `delete` | `changes.before` |
| `bulkDelete` | `meta.lookupValues` (no per-row payloads) |
| `relation.m2m` / `relation.o2m` | `meta.field`, `meta.added`, `meta.removed` (only when the relation field was present and the set changed) |

## 5. Failure semantics

Audit writes run **after** a successful mutation and are **best-effort**. If the audit insert (or custom `write`) fails, the error is logged and the user-facing CRUD response still succeeds. Mutations and audit rows are not wrapped in a shared transaction.

## 6. Field redaction

- Global: `configureAudit({ excludeFields: ['password'] })`
- Per model: `audit: { excludeFields: ['secret'] }` or `includeFields: ['id', 'title']` (include list wins when set). Works with global `enabled: true` without repeating `audit: true`.
