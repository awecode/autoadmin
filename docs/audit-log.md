# Audit Logs

Opt-in activity logging for Drizzle admin writes (create, update, delete, bulk delete, and m2m/o2m relation changes).

## 1. Enable auditing

In your Nitro admin plugin:

```ts
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { posts, users } from '~~/server/db/schema'

export default defineNitroPlugin(() => {
  const registry = useAdminRegistry()

  registry.configureAudit({
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

- Set `enabled: true` to audit all models by default, or set `audit: true` / options on individual models.
- Use `audit: false` in model-specific admin registration to opt the model out when global enable is on.
- The list/view admin UI is registered automatically unless `ui: false`.

### Custom sink

```ts
registry.configureAudit({
  write: async (entry) => {
    // send to your logger, queue, etc.
    console.info(entry)
  },
  enabled: true,
})
```

## 2. Actor identity

By default, `event.context.auth.user` is read for saving as the audit log's actor data (`id`, `role`, `email` / `name`). Override it via `#autoadmin/roleAccess` (same alias as role helpers), or pass `getActor` to `configureAudit`.

## 3. What is logged

| Action | Payload |
|--------|---------|
| `create` | Full `changes.after` |
| `update` | Only keys that changed, in both `changes.before` and `changes.after` (no-op saves are skipped) |
| `delete` | Full `changes.before` |
| `bulkDelete` | `meta.lookupValues` (no per-row payloads) |
| `relation.m2m` / `relation.o2m` | `meta.field`, `meta.added`, `meta.removed` (only when the relation field was present and the set changed) |

## Notes

- Failure semantics : Audit writes run **after** a successful mutation and are **best-effort**. If the audit insert (or custom `write`) fails, the error is logged and the user-facing CRUD response still succeeds. Mutations and audit rows are not wrapped in a shared transaction.

- Field redaction:
  - Global: `configureAudit({ excludeFields: ['password'] })`
  - Per model: `audit: { excludeFields: ['secret'] }` or `includeFields: ['id', 'title']` (include list wins when set). Works with global `enabled: true` without repeating `audit: true`.

- Internal table: AutoAdmin owns the `autoadmin_audit_logs` table. You do not add it to your Drizzle schema. On first insert, if the table is missing, AutoAdmin creates it and retries once. Steady-state writes are insert-only (no DDL).
