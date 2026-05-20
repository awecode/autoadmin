# Deploying to Cloudflare Pages (and other serverless runtimes)

JSON admin's GitHub storage adapter needs `NUXT_AUTOADMIN_GITHUB_TOKEN` at **request time**. On long-running Node servers this is automatic — `useRuntimeConfig()` is populated from `process.env` at boot. On **Cloudflare Pages / Workers** and other V8-isolate runtimes, the story is different and the default setup fails in production with a 500.

This page documents the failure mode and the per-request token-injection pattern that fixes it.

---

## Why the default setup breaks on Cloudflare

On Cloudflare Pages, secrets configured in the dashboard are **not** present on `process.env` when Nitro builds `runtimeConfig`. They are delivered per request on `event.context.cloudflare.env`.

Two symptoms follow:

1. **At boot**, `runtimeConfig.autoadmin.github.token` resolves to an empty string. The factory in `server/utils/jsonStorage/factory.ts` sees no token and either falls back to local storage (dev) or throws **500** (production):

   > GitHub token missing for this JSON resource in non-dev environment. Set NUXT_AUTOADMIN_GITHUB_TOKEN / runtimeConfig.autoadmin.github.token, or use local storage.

2. **At request time**, trying to patch `useRuntimeConfig().autoadmin.github.token = …` may throw, because the config object is **deep-frozen** in some serverless builds. You can't simply re-assign it from middleware.

The fix is to inject the token from the Cloudflare per-request env into the **registry's stored resource configs**, where the storage factory already looks first.

---

## Per-request token-injection middleware

Drop this in `server/middleware/admin-auth.ts` of the **consuming** Nuxt project (not in the autoadmin layer). It runs before the autoadmin API handlers, so every JSON-admin call sees a token in its resource's `storage` block.

```ts
// server/middleware/admin-auth.ts
import { createError } from 'h3'
import { useJsonResourceRegistry } from '#layers/autoadmin/server/utils/jsonResourceRegistry'

export default defineEventHandler((event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/autoadmin')) {
    return
  }

  // 1. Resolve the token for this request.
  //    On Cloudflare Pages the secret lives on event.context.cloudflare.env,
  //    not on process.env at boot.
  const token
    = event.context.cloudflare?.env?.NUXT_AUTOADMIN_GITHUB_TOKEN
      ?? process.env.NUXT_AUTOADMIN_GITHUB_TOKEN

  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      throw createError({
        statusCode: 500,
        statusMessage:
          'NUXT_AUTOADMIN_GITHUB_TOKEN is not configured. Set it in the '
          + 'Cloudflare Pages dashboard (or your serverless platform).',
      })
    }
    return // dev falls back to local storage in the factory
  }

  // 2. Inject the token into the registered JSON resources.
  //    The storage factory checks `storage.token` before runtimeConfig,
  //    so this wins even if runtimeConfig is frozen.
  const registry = useJsonResourceRegistry()
  for (const resource of registry.all()) {
    if (resource.storage.kind === 'github') {
      resource.storage.token = token
    }
  }

  // 3. Best-effort: also update runtimeConfig for any code that reads it
  //    directly. Wrapped in try/catch because some runtimes freeze it.
  try {
    const config = useRuntimeConfig()
    config.autoadmin = config.autoadmin || {}
    config.autoadmin.github = config.autoadmin.github || {}
    config.autoadmin.github.token = token
  }
  catch {
    // runtimeConfig is frozen in production on some serverless platforms.
    // Step 2 already covered the JSON-admin path.
  }
})
```

> Add your own auth check (session cookie, JWT, etc.) at the top of this middleware. Token injection alone does not authenticate the request — it only makes GitHub storage work.

---

## Why this works

`server/utils/jsonStorage/factory.ts` resolves the GitHub token in this order:

1. `storage.token` on the **per-resource** config (set by the middleware above).
2. `runtimeConfig.autoadmin.github.token`.
3. Empty → throw 500 (or fall back to local storage in dev).

Because step 1 is a plain object property on the registry's in-memory store, you can mutate it from any request handler. Step 2 may be frozen; step 1 isn't.

---

## Configuration checklist

In the Cloudflare Pages dashboard, under **Settings → Environment variables** for the production environment:

| Variable | Required | Notes |
|----------|:--------:|-------|
| `NUXT_AUTOADMIN_GITHUB_TOKEN` | yes | Fine-grained PAT with `contents:read` and `contents:write` on the target repo. |
| `NUXT_AUTOADMIN_GITHUB_OWNER` | yes* | Or set `storage.owner` per-resource. |
| `NUXT_AUTOADMIN_GITHUB_REPO`  | yes* | Or set `storage.repo` per-resource. |
| `NUXT_AUTOADMIN_GITHUB_REF`   | no   | Defaults to the repo's default branch. |
| `NUXT_DATABASE_URL`           | yes  | For Drizzle admin. D1 binding is auto-detected if the binding is named `DB`. |

\* required unless every JSON resource sets its own `storage.owner` / `storage.repo`.

Make sure the variables are set on **both** the Production and Preview environments if you use preview deployments.

---

## Verifying

After deploy, a quick sanity check from a logged-in admin session:

```
GET  /api/autoadmin/json/<resource-key>/        → 200 with the current document
PUT  /api/autoadmin/json/<resource-key>/        → 200, returns a new revision
```

A `500` with `GitHub token missing for this JSON resource …` means the middleware didn't see the env var — check the dashboard variable name (it must be exactly `NUXT_AUTOADMIN_GITHUB_TOKEN`).

A `500` with `Cannot assign to read only property` or similar in logs means a code path is still trying to mutate `useRuntimeConfig()` directly. The middleware above wraps that in `try/catch`; any other call site should do the same.

---

## Applies to

This pattern is not Cloudflare-specific. Any runtime that delivers secrets per-request rather than at boot (Vercel Edge, Deno Deploy, some Lambda configurations) needs the same shape: read the secret from the request-scoped env, write it into the registry's resource storage, don't trust `runtimeConfig` to be mutable.
