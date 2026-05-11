# AutoAdmin: registration roles

Optional per-model **`roles`** on `registry.register(model, options)` restrict who may call the CRUD API and related endpoints. When `roles` is omitted, **no role check** runs.

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

## Evaluation order

1. If `roles` is missing or has **no** non-empty arrays after normalization → **allow** (no check).
2. If **`roles.full`** is non-empty and the user’s role is in that list → **allow**.
3. Otherwise, allow only if the user’s role matches the action type.
4. Respond with **403**.

## Override for custom role logic: `#autoadmin/roleAccess`

The autoadmin layer aliases **`#autoadmin/roleAccess`** to the default role check util. In your app, point the alias at your own file which should export `getUserRoleFromEvent` and `assertRoleAccessAllowed`:

- **`getUserRoleFromEvent(event)`** — gets the current user’s role string from session/event, takes H3/nitro event function parameter; returns role string or `undefined`
- **`assertRoleAccessAllowed(event, policy, access)`** — performs access check for the role.

See [server/utils/roleAccess.ts](https://github.com/awecode/autoadmin/blob/main/server/utils/roleAccess.ts) for the existing logic.

## Global file upload roles

File uploads (`POST …/file-upload`) can be restricted with by providing a list of role name strings in **`runtimeConfig.autoadmin.fileUploadRoles`**, or by setting **`NUXT_AUTOADMIN_FILE_UPLOAD_ROLES`** to a comma-separated list (e.g. `admin,editor`).
