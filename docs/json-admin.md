# JSON admin

JSON Admin provides a simple admin interface for managing **JSON files** in your codebase. It supports both single-object files and collections of objects, with built-in list, create, update, and delete interfaces.

It is designed for data that changes occasionally but still benefits from a user-friendly editing UI without requiring a database or a full CMS. Changes are written directly to your repository, making it a good fit for Git-based workflows and configuration-driven applications.

Common use cases include:

- Site settings and application configuration
- Feature flags and rollout controls
- Navigation menus and footer links
- CMS-style content lists such as team members, FAQs, testimonials, or partner logos
- Static reference data and lookup tables
- Local development fixtures and seed content
- Structured content stored alongside source code

JSON Admin is especially useful when you want non-developers or operators to safely manage structured content that lives in version control.

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
      href: z.url().optional(),
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
| **GitHub** | `storage: { kind: 'github', owner?, repo?, ref? }` and a **non-empty token** | Contents API; optimistic concurrency via blob `sha`. `path` is **repo-relative** to the JSON file. `owner` / `repo` / `ref` can be omitted if set globally on `runtimeConfig.autoadmin.github` or via `NUXT_AUTOADMIN_GITHUB_*`. |
| **Local** | `storage: { kind: 'local' }` or as a fallback in dev environment when GitHub token is not configured | File at `path`, resolved under `runtimeConfig.autoadmin.jsonLocalRoot` when `path` is relative, or as an absolute path. Uses file `mtime` for concurrency. |

---

## Configuration

Configure these in your project's `nuxt.config.ts` runtime config, or via the matching environment variable. Server values are private; `public.autoadmin.jsonadmin` values are available to the client UI.

| Runtime key | Env var | Default | Purpose |
|-------------|---------|---------|---------|
| `autoadmin.github.token` | `NUXT_AUTOADMIN_GITHUB_TOKEN` | empty | Default GitHub PAT for JSON admin when `storage.kind === 'github'`. |
| `autoadmin.github.owner` | `NUXT_AUTOADMIN_GITHUB_OWNER` | empty | Default GitHub org or user. |
| `autoadmin.github.repo` | `NUXT_AUTOADMIN_GITHUB_REPO` | empty | Default repo name. |
| `autoadmin.github.ref` | `NUXT_AUTOADMIN_GITHUB_REF` | empty | Branch or tag for the GitHub Contents API. |
| `autoadmin.jsonLocalRoot` | `NUXT_AUTOADMIN_JSON_LOCAL_ROOT` | Project root (`process.cwd()`) | Base directory for **relative** local JSON paths. |
| `public.autoadmin.jsonadmin.jsonApiPrefix` | `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_JSON_API_PREFIX` | `{apiPrefix}/json` | JSON admin API base URL. |
| `public.autoadmin.jsonadmin.linkLabel` | `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_LABEL` | `Configuration` | Label for the optional sidebar link, dashboard tile, and JSON index heading. |
| `public.autoadmin.jsonadmin.linkIcon` | `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_ICON` | `i-lucide-settings-2` | Nuxt UI icon name for that link/tile. |
| `public.autoadmin.jsonadmin.injectSidebar` | `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_INJECT_SIDEBAR` | `true` | Set to `false` to stop prepending the JSON index link to the **additional** sidebar group. |
| `public.autoadmin.jsonadmin.showDashboardCard` | `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_SHOW_DASHBOARD_CARD` | `true` | Set to `false` to hide the Drizzle dashboard tile. |
| `public.autoadmin.jsonadmin.takeoverMode` | `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_TAKEOVER_MODE` | `auto` | `auto` \| `always` \| `never` — JSON-first shell when Drizzle nav is empty and JSON has links (`auto`), always, or never. |

Per-resource **`githubToken`** / `storage.token` overrides the global token when a repo needs a different credential. Prefer loading token from env or a secret manager instead of hardcoding.

### Takeover and injection

- **`takeoverMode: 'auto'`:** If the current user sees **no** Drizzle models but **does** see JSON resources, the home route and primary sidebar block show **JSON admin**.
- **`always` / `never`:** Force that layout on or off regardless of availability of Drizzle model admins.
- When takeover is **off** and JSON resources exist, **`injectSidebar`** / **`showDashboardCard`** control the extra link and tile.

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
