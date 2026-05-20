# Error reference: JSON admin storage

Every error thrown by the JSON admin storage layer, with the exact message, the likely cause, and how to recover. Errors are listed by source file.

For limits and sizing context, see [storage-limits.md](./storage-limits.md). For the Cloudflare-specific token-injection issue, see [deploying-cloudflare-pages.md](./deploying-cloudflare-pages.md).

---

## `server/utils/githubContents.ts` — GitHub Contents + Blobs API

| Status | Message | Likely cause | Remediation |
|:------:|---------|--------------|-------------|
| **404** | `<GitHub message>` or `GitHub API error (404)` | File at `path` does not exist on `ref`. | First-write flows treat this as "create new". For reads, verify `owner`, `repo`, `ref`, and `path` exactly match the file in the repo. |
| **400** | `<GitHub message>` or `GitHub API error (<status>)` | Any 4xx from Contents API other than 404 — most often `401`/`403` (bad/missing token, repo permissions), or `422` (invalid request). | Confirm the token has `contents:read` (and `contents:write` for saves) on the repo. Check the token isn't expired. |
| **502** | `<GitHub message>` or `GitHub API error (<5xx>)` | GitHub returned 5xx (rare outage, secondary rate limit). | Retry. If persistent, check status.github.com and your token's rate-limit headers. |
| **500** | `GitHub response is not a single file with content.` | The path resolved to a directory, submodule, or symlink instead of a regular file. | Point `path` at a regular `.json` file, not a directory. |
| **400** | `<GitHub Blobs message>` or `GitHub Blobs API error (<status>)` | The Contents API said the file is too big for inline content (>1 MB), so JSON admin fell back to the Git Blobs API and that call returned 4xx. Usually means the token can read repo metadata but not raw blobs, or the blob `sha` was rotated mid-request. | Confirm the token has `contents:read`. If `sha` rotation is the cause, retry — JSON admin re-reads `sha` on each call. |
| **502** | `<GitHub Blobs message>` or `GitHub Blobs API error (<5xx>)` | 5xx on Blobs fallback. | Retry. Persistent failures here usually mean the file is at or above the 100 MB Blobs hard ceiling. |
| **500** | `GitHub Blobs API response is missing base64 content.` | Blobs API returned successfully but with a non-`base64` encoding or no string content. Effectively unreachable for normal JSON files. | File the issue with a repro — this indicates a corrupted blob or an API change. |
| **422** | `File is not valid JSON.` | Decoded file contents could not be `JSON.parse`d. Usually means a human edited the file in Git directly and broke it. | Open the file on the configured `ref` and fix the JSON. JSON admin will not overwrite an unparseable file. |
| **409** | `<GitHub message>` or `GitHub file changed on the server (sha conflict). Refresh and try again.` | Optimistic concurrency: another writer updated the file between this request's read and write. The CRUD service already retried once. | Reload the admin UI and re-apply the change. Frequent 409s mean too many concurrent editors for the single-file model — see [storage-limits.md](./storage-limits.md). |
| **400** | `<GitHub message>` or `GitHub API error (<status>)` | PUT-side 4xx other than 409 — branch protection, missing write scope, payload too large. | Check token scopes, branch protection rules, and whether the file is above the 100 MB hard ceiling. |
| **502** | `<GitHub message>` or `GitHub API error (<5xx>)` | 5xx on write. | Retry. |

> **About the 1 MB → 100 MB fallback.** When the Contents API returns `encoding: "none"` (file >1 MB), JSON admin transparently re-reads via `GET /repos/{owner}/{repo}/git/blobs/{sha}`. Reads still succeed up to 100 MB. **Writes** still go through the Contents API, which accepts up to ~100 MB but is slow and memory-heavy above a few MB.

---

## `server/utils/jsonStorage/factory.ts` — adapter selection

| Status | Message | Likely cause | Remediation |
|:------:|---------|--------------|-------------|
| **500** | `GitHub token missing for this JSON resource in non-dev environment. Set NUXT_AUTOADMIN_GITHUB_TOKEN / runtimeConfig.autoadmin.github.token, or use local storage.` | A resource is registered with `storage: { kind: 'github' }` but no token was found on the per-resource config, on `runtimeConfig.autoadmin.github.token`, or on `NUXT_AUTOADMIN_GITHUB_TOKEN`. Dev mode silently falls back to local storage; production refuses. | Set the env var. On serverless platforms where `runtimeConfig` is populated from `process.env` at boot but secrets are delivered per-request, use the middleware pattern in [deploying-cloudflare-pages.md](./deploying-cloudflare-pages.md). |

---

## `server/utils/jsonStorage/localJsonRepository.ts` — local files

| Status | Message | Likely cause | Remediation |
|:------:|---------|--------------|-------------|
| **422** | `Local JSON file is not valid JSON.` | The on-disk file at `absolutePath` could not be `JSON.parse`d. | Open the file and fix it. JSON admin will not overwrite an unparseable file. |
| **409** | `Local JSON file changed on disk. Refresh and try again.` | The file's `mtime` changed between the read and the write — concurrent edit. The CRUD service already retried once. | Reload the admin UI and re-apply the change. |
| **409** | `Local JSON file was created concurrently. Refresh and try again.` | The client expected the file to not exist yet (`revision === '0'`), but it was created by another writer in the meantime. | Reload the admin UI; you'll now see the other writer's content as the baseline. |

---

## Cross-cutting notes

- **Where the messages surface.** The admin UI shows `statusMessage` as the toast text on failed requests. If you proxy these errors through your own handler, preserve `statusCode` and `statusMessage` so the UI behaves correctly.
- **Logging.** None of these throw paths log by default. Wrap calls at the route layer if you need structured logs.
- **`createError` source.** All errors are thrown via Nitro's `createError` and serialize as standard `H3Error` shapes.
