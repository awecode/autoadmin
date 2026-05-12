# AutoAdmin: registration roles

Optional per-model **`roles`** on `registry.register(model, options)` (Drizzle) and `useJsonResourceRegistry().register({ ... })` (JSON admin) restrict who may call the CRUD API and related endpoints. When `roles` is omitted, **no role check** runs.

The default checker reads **`event.context.auth.user.role`** as a string. Missing or insufficient role for a protected request returns **403 Forbidden**.

## 1. Basic usage

Use this when the role(s) can do everything on that resource.

```ts
registry.register(posts, {
  label: 'Posts',
  roles: ['admin', 'support'],
})
```

## 2. Per-action

```ts
registry.register(orders, {
  label: 'Orders',
  roles: {
    list: ['dispatcher'],
    view: ['dispatcher', 'account'],
    create: ['dispatcher'],
    update: ['dispatcher', 'account'],
    delete: ['account'],
    full: ['admin'], // admins gets full access to all actions
  },
})
```

If the user’s role matches **`full`**, every action is allowed.

Otherwise:

- **`list`** — `GET` collection
- **`view`** — `GET` collection **or** `GET` detail
- **`create`**, **`update`**, **`delete`** — the corresponding mutations

## 3. No roles

Omit `roles` for models that should not enforce role checks at the AutoAdmin layer (if you are using your own middleware).

```ts
registry.register(posts, {
  label: 'Posts',
})
```

## 4. JSON admin

The same `roles` shape works for `useJsonResourceRegistry().register(...)` on both array and object resources.

```ts
useJsonResourceRegistry().register({
  kind: 'array',
  key: 'site-banners',
  elementSchema,
  roles: ['admin', 'editor'],
})

useJsonResourceRegistry().register({
  kind: 'object',
  key: 'site-settings',
  schema,
  roles: {
    update: ['admin'],
    view: ['admin', 'support'],
  },
})
```

Object resources only support `detail`/`update` over HTTP (their UI is an editor); `list` / `create` / `delete` keys are ignored for them but still validate as part of the shape.

## Evaluation order

1. If `roles` is missing or has **no** non-empty arrays after normalization → **allow** (no check).
2. If **`roles.full`** is non-empty and the user’s role is in that list → **allow**.
3. Otherwise, allow only if the user’s role matches the action type.
4. Respond with **403**.

## Override for custom role logic: `#autoadmin/roleAccess`

The autoadmin layer aliases **`#autoadmin/roleAccess`** to the default role check util. In your app, point the alias at your own file which should export `getUserRoleFromEvent` and `isAccessAllowed`:

- **`getUserRoleFromEvent(event)`** - extracts the current user’s role string from an H3/nitro event; returns role string or `undefined`. Override to read from a different session shape.
- **`isAccessAllowed(userRole, roles, action)`** - decide whether a resolved `userRole` may perform `action` under `roles`

See [server/utils/roleAccess.ts](https://github.com/awecode/autoadmin/blob/main/server/utils/roleAccess.ts) for the existing logic.

## Global file upload roles

File uploads (`POST …/file-upload`) can be restricted with by providing a list of role name strings in **`runtimeConfig.autoadmin.fileUploadRoles`**, or by setting **`NUXT_AUTOADMIN_FILE_UPLOAD_ROLES`** to a comma-separated list as shown in the example below:
```
NUXT_AUTOADMIN_FILE_UPLOAD_ROLES=["admin","editor"]
```
