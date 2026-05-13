# JSON admin

JSON admin is a parallel admin surface backed by **JSON documents** (single objects or arrays) instead of Drizzle tables. Resources are registered on the server with `useJsonResourceRegistry().register(...)`. The UI lives under `{pathPrefix}/json` (for example `/admin/json`), and JSON CRUD is served under the JSON admin API prefix (see below).

For **role restrictions** on JSON resources, see [autoadmin-roles.md](./autoadmin-roles.md) (section “JSON admin”).

## Registration

Register from a Nitro plugin (same pattern as Drizzle `useAdminRegistry()`):

```ts
// e.g. server/plugins/json-admin.ts
export default defineNitroPlugin(() => {
  useJsonResourceRegistry().register({
    kind: 'object',
    key: 'site-settings',
    label: 'Site settings',
    schema: siteSettingsSchema,
    // storage, path, roles, ...
  })
})
```

Object resources open an editor; array resources get list/create/update flows. See existing playground plugins and [`server/utils/jsonResourceRegistry.ts`](../server/utils/jsonResourceRegistry.ts) for the full `register` input shape (storage, `enableIndex`, list options, etc.).

## Routes and API

- **Pages**: `{pathPrefix}/json` (index grid), plus per-resource routes registered in Nuxt `pages:extend` (object edit, array list, create, update). `pathPrefix` defaults to `/admin` via `runtimeConfig.public.autoadmin.pathPrefix`.
- **JSON API base** (no trailing slash): `runtimeConfig.public.autoadmin.jsonApiPrefix` when set; otherwise `{apiPrefix}/json` where `apiPrefix` defaults to `/api/autoadmin`. Client composable: `useJsonAdminApiPrefix()`.

## Navigation and dashboard (`public.autoadmin.jsonadmin`)

The runtime key under `public.autoadmin` must be spelled exactly **`jsonadmin`** (all lowercase, not `jsonAdmin`). Nested options use **camelCase**.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `linkLabel` | `string` | `'Configuration'` | Label for the sidebar link and trailing dashboard card (non-takeover), and for the JSON index page title. |
| `linkIcon` | `string` | `'i-lucide-settings-2'` | Nuxt UI icon for that link/card. |
| `injectSidebar` | `boolean` | `true` | When rules apply, prepend this link to the **additional** sidebar group (above GitHub/Help, sign-out stays last). |
| `showDashboardCard` | `boolean` | `true` | When rules apply, append a card on the Drizzle dashboard as the **last** tile (non-takeover only). |
| `takeoverMode` | `'auto' \| 'always' \| 'never'` | `'auto'` | Controls JSON-first “takeover” of the admin home and primary sidebar block. |

### Takeover behavior

- **`never`**: Never use JSON-first layout. If JSON resources exist and Drizzle nav is empty, you still get sidebar injection + dashboard card (when those flags are true), not takeover.
- **`always`**: Always use JSON-first layout: the middle sidebar group lists **only** JSON resources (Drizzle links are omitted from the sidebar). The dashboard route at `pathPrefix` renders the **same** JSON registry grid as `/json` (no extra “Configuration” link in additional items). If no JSON links are visible for the user (empty registry or roles), the middle nav shows only a label and the home grid shows the empty-state alert.
- **`auto`**: Takeover when **Drizzle** `registry-meta` is empty for the user **and** JSON `registry-meta` has at least one link. Same sidebar and home behavior as `always` in that case.

“Empty Drizzle nav” means no list/create targets after `enableIndex` and role checks—the same rules as the existing registry meta API.

### Non-takeover injection

When takeover is **inactive** and JSON registry-meta returns at least one link: if `injectSidebar` is true, a link to the JSON index (`jsonadmin-index`) is prepended to additional sidebar items. If `showDashboardCard` is true, a matching card is appended as the **last** item on the Drizzle dashboard grid.

## Environment variables

Overrides map to `runtimeConfig.public.autoadmin.jsonadmin` (Nuxt public env naming):

| Variable | Maps to |
|----------|---------|
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_LABEL` | `linkLabel` |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_ICON` | `linkIcon` |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_INJECT_SIDEBAR` | Set to `false` to disable injection |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_SHOW_DASHBOARD_CARD` | Set to `false` to hide the dashboard card |
| `NUXT_PUBLIC_AUTOADMIN_JSONADMIN_TAKEOVER_MODE` | `auto`, `always`, or `never` (case-insensitive; invalid values fall back to `auto`) |

## UI building blocks

- [`utils/jsonAdmin.ts`](../utils/jsonAdmin.ts) — `resolveJsonAdminApiPrefix`, `JsonAdminPublicRuntime` / UI config types, and `JsonAdminRegistryLink`.
- [`components/JsonAdminRegistryGrid.vue`](../components/JsonAdminRegistryGrid.vue) — shared grid + empty alert.
- [`composables/useAutoadminJsonAdminUi.ts`](../composables/useAutoadminJsonAdminUi.ts) — takeover and injection flags from runtime config + registry meta lengths.
