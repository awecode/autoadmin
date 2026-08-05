# Audit Logs

Opt-in activity logging for Drizzle admin writes (create, update, delete, bulk delete, and m2m/o2m relation changes). Entries follow a proven activity-log shape: action, subject (`modelKey` + `lookupValue`), actor, `changes` JSON, optional `meta`, and timestamp.

JSON admin is not audited in this version.

## 1. Add the audit table to your schema

Import the dialect-specific table from the layer and re-export it from your app schema, then run your usual drizzle-kit generate/migrate.

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

## 2. Configure the writer

In your Nitro admin plugin:

```ts
import { auditLogs, posts } from '~~/server/db/schema'
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'

export default defineNitroPlugin(() => {
  const registry = useAdminRegistry()

  registry.configureAudit({
    table: auditLogs,
    // Optional: strip sensitive fields from all models
    // excludeFields: ['passwordHash'],
  })

  // Optional: list/view UI (create/update/delete disabled)
  registry.registerAuditLog(auditLogs, {
    roles: ['admin'],
  })

  registry.register(posts, {
    audit: true,
    // Or: audit: { excludeFields: ['content'], includeFields: ['title', 'status'] }
  })
})
```

- Without `configureAudit({ table })` or a custom `write`, emits are no-ops.
- Per-model `audit` defaults to off. Set `audit: true` (or an options object) to enable.
- If both `table` and `write` are set, **`write` replaces** the default table insert.

### Custom sink

```ts
registry.configureAudit({
  write: async (entry) => {
    // send to your logger, queue, etc.
    console.info(entry)
  },
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
- Per model: `audit: { excludeFields: ['secret'] }` or `includeFields: ['id', 'title']` (include list wins when set)
