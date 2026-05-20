import type { JsonStorageRepository } from './types'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { GithubJsonRepository } from './githubJsonRepository'
import { LocalJsonRepository } from './localJsonRepository'

export type JsonStorageConfig
  = | {
    kind: 'github'
    owner: string
    repo: string
    path: string
    ref?: string
    /**
     * GitHub API bearer token. Prefer the **global** token from server environment
     * (`NUXT_AUTOADMIN_GITHUB_TOKEN` / `runtimeConfig.autoadmin.github.token`) and omit
     * this field. Use a **storage-specific** token only when this repo needs a different
     * credential; load it from environment or a server-side secret store at runtime —
     * never commit tokens or pass them from untrusted clients.
     */
    token?: string
    /**
     * Throw 413 when the file size exceeds this many bytes (read or write).
     * Use as a hard ceiling to prevent runaway growth. See docs/storage-limits.md.
     */
    maxBytes?: number
    /**
     * Emit a console.warn once per path when content crosses this many bytes.
     * Useful as an early-warning threshold (e.g. 1 MB to flag the Blobs-API fallback boundary).
     */
    warnAtBytes?: number
  }
  | {
    kind: 'local'
    absolutePath: string
  }

function jsonAdminLocalRoot(): string {
  const config = useRuntimeConfig()
  const fromCfg = config.autoadmin?.jsonLocalRoot
  if (fromCfg) {
    return resolve(fromCfg)
  }
  return resolve(process.cwd())
}

function trimString(value: unknown): string | undefined {
  return value == null ? undefined : (String(value).trim() || undefined)
}

export function getAutoadminGithubRuntime() {
  const g = useRuntimeConfig().autoadmin?.github ?? {}
  return {
    token: trimString(g.token),
    owner: trimString(g.owner),
    repo: trimString(g.repo),
    ref: trimString(g.ref),
  }
}

/** Per-resource override first, then `runtimeConfig.autoadmin.github` / `NUXT_AUTOADMIN_GITHUB_TOKEN`. */
export function resolveGithubTokenForStorage(explicit?: string | null): string | undefined {
  const t = explicit == null ? '' : String(explicit).trim()
  if (t) {
    return t
  }
  return getAutoadminGithubRuntime().token
}

// Resolve a path relative to `runtimeConfig.autoadmin.jsonLocalRoot`, or an absolute filesystem path.
export function resolveLocalJsonAdminPath(pathInput: string): string {
  if (pathInput.startsWith('/') || /^[A-Z]:[\\/]/i.test(pathInput)) {
    return resolve(pathInput)
  }
  return resolve(join(jsonAdminLocalRoot(), pathInput))
}

// Dev-only
export function isJsonAdminDevStorageFallback(): boolean {
  if (import.meta.dev) {
    return true
  }
  return process.env.NODE_ENV !== 'production'
}

function defaultParsedForKind(resourceKind: 'object' | 'array'): unknown {
  return resourceKind === 'array' ? [] : {}
}

// GitHub Contents when a token exists; in dev only, missing token falls back to local `path`.
export function createJsonStorageRepository(
  storage: JsonStorageConfig,
  resourceKind: 'object' | 'array',
): JsonStorageRepository {
  if (storage.kind === 'local') {
    return new LocalJsonRepository({
      absolutePath: storage.absolutePath,
      defaultIfMissing: defaultParsedForKind(resourceKind),
    })
  }

  const token = resolveGithubTokenForStorage(storage.token)
  if (token) {
    return new GithubJsonRepository({
      token,
      owner: storage.owner,
      repo: storage.repo,
      path: storage.path,
      ref: storage.ref,
      defaultIfMissing: defaultParsedForKind(resourceKind),
      maxBytes: storage.maxBytes,
      warnAtBytes: storage.warnAtBytes,
    })
  }

  if (!isJsonAdminDevStorageFallback()) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'GitHub token missing for this JSON resource in non-dev environment. Set NUXT_AUTOADMIN_GITHUB_TOKEN / runtimeConfig.autoadmin.github.token, or use local storage.',
    })
  }

  return new LocalJsonRepository({
    absolutePath: resolveLocalJsonAdminPath(storage.path),
    defaultIfMissing: defaultParsedForKind(resourceKind),
  })
}
