# JSON admin

JSON admin is an admin surface for **JSON files** (one object or an array of objects) with list/create/update UIs. It is ideal for site settings, feature flags, CMS-ish lists stored in Git, or local dev fixtures. You can use it to update source code directly in your repository for things that need less frequent update and you don't want to keep in the database.

---

## Register resources

Use a **`server/plugins/*.ts`** file with `defineNitroPlugin` (same lifecycle style as `useAdminRegistry()` for Drizzle).

```ts
// server/plugins/json-admin.ts
import { useJsonResourceRegistry } from '#layers/autoadmin/server/utils/jsonResourceRegistry'
import { z } from 'zod'

export default defineNitroPlugin(() => {
  const { register } = useJsonResourceRegistry()

  register({
    kind: 'object',
    key: 'site-settings',
    label: 'Site settings',
    path: 'config/site-settings.json',
    storage: { kind: 'github', owner: 'myorg', repo: 'configs', ref: 'main' },
    schema: z.object({
      title: z.string(),
      maintenanceMode: z.boolean().optional(),
    }),
  })

  register({
    kind: 'array',
    key: 'banners',
    label: 'Home banners',
    path: 'content/banners.json',
    storage: { kind: 'local' },
    elementSchema: z.object({
      headline: z.string(),
      href: z.string().url().optional(),
    }),
  })
})
```
---

## Objects vs arrays

| | **Object (`kind: 'object'`)** | **Array (`kind: 'array'`)** |
|--|-------------------------------|------------------------------|
| **JSON file** | Single root object | JSON array of row objects |
| **Admin** | One edit screen | List, create, update (and delete when enabled) |

---

## Storage

Persistence is built from your **`path`** plus **`storage`**.

| Mode | When it applies | Notes |
|------|-----------------|--------|
| **GitHub** | `storage: { kind: 'github', owner?, repo?, ref? }` and a **non-empty token** (see [Server environment](#server-environment)) | Contents API; optimistic concurrency via blob `sha`. `path` is **repo-relative** to the JSON file. `owner` / `repo` / `ref` can be omitted if set globally on `runtimeConfig.autoadmin.github` or via `NUXT_AUTOADMIN_GITHUB_*`. |
| **Local** | `storage: { kind: 'local' }` or as a fallback in dev environment when GitHub token is not configured | File at `path`, resolved under `runtimeConfig.autoadmin.jsonLocalRoot` when `path` is relative, or as an absolute path. Uses file `mtime` for concurrency. |

---

## Configuration

| Variable | Role |
|----------|------|
| `NUXT_AUTOADMIN_GITHUB_TOKEN` | Default GitHub PAT for JSON admin (and related) when `storage.kind === 'github'`. Same as `runtimeConfig.autoadmin.github.token`. |
| `NUXT_AUTOADMIN_GITHUB_OWNER` | Default GitHub org or user (`runtimeConfig.autoadmin.github.owner`). |
| `NUXT_AUTOADMIN_GITHUB_REPO` | Default repo name (`runtimeConfig.autoadmin.github.repo`). |
| `NUXT_AUTOADMIN_GITHUB_REF` | Branch or tag for Contents API (`runtimeConfig.autoadmin.github.ref`). |
| `NUXT_AUTOADMIN_JSON_LOCAL_ROOT` | Base directory for **relative** local JSON paths (`runtimeConfig.autoadmin.jsonLocalRoot`). If unset, relative paths resolve from **`process.cwd()`** (project root) |

Per-resource **`githubToken`** / `storage.token` overrides the global token when a repo needs a different credential. Prefer loading token from env or a secret manager instead of hardcoding.

---

## UI options (`public.autoadmin.jsonadmin`)

These can be configured in your project's `nuxt.config.ts` or via respective environment variables.

| Property | Default | Purpose |
|----------|---------|---------|
| `jsonApiPrefix` | `{apiPrefix}/json` | JSON admin API base URL. |
| `linkLabel` | `Configuration` | Label for the optional sidebar link, dashboard tile, and JSON index heading. |
| `linkIcon` | `i-lucide-settings-2` | Nuxt UI icon name for that link/tile. |
| `injectSidebar` | `true` | When allowed, prepend the JSON index link to the **additional** sidebar group. |
| `showDashboardCard` | `true` | When allowed, append a tile on the Drizzle dashboard (last position). |
| `takeoverMode` | `auto` | `auto` \| `always` \| `never` — JSON-first shell when Drizzle nav is empty and JSON has links (`auto`), always, or never. |

### Takeover and injection

- **`takeoverMode: 'auto'`:** If the current user sees **no** Drizzle models in but **does** see JSON resources, the home route and primary sidebar block show **JSON admin**.
- **`always` / `never`:** Force that layout on or off regardless of availability of Drizzle model admins.
- When takeover is **off** and JSON resources exist, **`injectSidebar`** / **`showDashboardCard`** control the extra link and tile.

### Public env → `jsonadmin`

| Variable | Maps to |
|----------|---------|
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_JSON_API_PREFIX` | `jsonApiPrefix` |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_LABEL` | `linkLabel` |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_ICON` | `linkIcon` |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_INJECT_SIDEBAR` | Set to `false` to disable sidebar injection |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_SHOW_DASHBOARD_CARD` | Set to `false` to hide the dashboard tile |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_TAKEOVER_MODE` | `auto`, `always`, or `never` (invalid values should be avoided; defaults to `auto` if unset) |

---

## Other notes

- **Auth:** Optional per-resource `roles` — same as Drizzle admin; see [autoadmin-roles.md](./autoadmin-roles.md).
- **`labelField`** (optional) chooses the column used for list titles / default search; otherwise the first schema field (other than `_id`) is used.
- Each row for `array` kind gets an internal **`_id`** (UUID): stored in the JSON file, used in URLs, **not** part of your `elementSchema`. **Do not** declare `_id` on `elementSchema` (it is reserved).
- Each save is **read → merge → write**; conflicts return **409** and the server may retry once (GitHub `sha` / local `mtime`).
- Opening a **list** may write missing `_id` values once (migration-style). If older data used another key (e.g. `id`), copy values into `_id` or re-save from the UI.
- On **read**, top-level `null` / `undefined` keys are stripped so Zod **defaults** can apply; **missing** keys are filled from schema defaults when present, otherwise simple sentinels (`''`, `false`, `0`, `{}`, `[]`, first enum value) so an empty file still opens the form. On **save**, the real document is written.

<!--
## Source map

| Area | File |
|------|------|
| Registration API | [`server/utils/jsonResourceRegistry.ts`](../server/utils/jsonResourceRegistry.ts) |
| HTTP handlers | [`server/api/autoadmin/json/`](../server/api/autoadmin/json/) |
| CRUD + object read merge | [`server/services/jsonResourceCrud.ts`](../server/services/jsonResourceCrud.ts) |
| Storage resolution | [`server/utils/jsonStorage/normalizeRegisterStorage.ts`](../server/utils/jsonStorage/normalizeRegisterStorage.ts), [`server/utils/jsonStorage/factory.ts`](../server/utils/jsonStorage/factory.ts) |
| Prefix + types | [`utils/jsonAdmin.ts`](../utils/jsonAdmin.ts) |
| Sidebar / dashboard policy | [`composables/useJsonAdminUi.ts`](../composables/useJsonAdminUi.ts) |
| Index grid UI | [`components/JsonAdminRegistryGrid.vue`](../components/JsonAdminRegistryGrid.vue) | -->
