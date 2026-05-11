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
    ref: string
    /**
     * GitHub API bearer token. Prefer the **global** token from server environment
     * (`NUXT_AUTOADMIN_GITHUB_TOKEN` / `runtimeConfig.autoadmin.github.token`) and omit
     * this field. Use a **storage-specific** token only when this repo needs a different
     * credential; load it from environment or a server-side secret store at runtime —
     * never commit tokens or pass them from untrusted clients.
     */
    token?: string
  }
  | {
    kind: 'local'
    absolutePath: string
  }

function jsonAdminLocalRoot(): string {
  const config = useRuntimeConfig() as {
    jsonAdmin?: { localRoot?: string }
  }
  const fromCfg = config.jsonAdmin?.localRoot
  if (fromCfg) {
    return resolve(fromCfg)
  }
  return resolve(process.cwd(), 'data')
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

// Resolve a path relative to `jsonAdmin.localRoot`, or an absolute filesystem path.
export function resolveLocalJsonAdminPath(pathInput: string): string {
  if (pathInput.startsWith('/') || /^[A-Z]:[\\/]/i.test(pathInput)) {
    return resolve(pathInput)
  }
  return resolve(join(jsonAdminLocalRoot(), pathInput))
}

// When GitHub token is missing, allow a local path for dev
export function isJsonAdminDevStorageFallback(): boolean {
  if (import.meta.dev) {
    return true
  }
  return process.env.NODE_ENV !== 'production'
}

function githubDevMirrorAbsolutePath(g: Extract<JsonStorageConfig, { kind: 'github' }>): string {
  const segments = g.path.replace(/^\/+/, '').split('/').filter(Boolean)
  return resolve(join(jsonAdminLocalRoot(), '_github_dev', g.owner, g.repo, ...segments))
}

function defaultParsedForKind(resourceKind: 'object' | 'array'): unknown {
  return resourceKind === 'array' ? [] : {}
}

// GitHub Contents when a token exists; otherwise local path in dev or 500 in production.
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

  const token = (storage.token || '').trim() || getAutoadminGithubRuntime().token
  if (token) {
    return new GithubJsonRepository({
      token,
      owner: storage.owner,
      repo: storage.repo,
      path: storage.path,
      ref: storage.ref,
    })
  }

  if (!isJsonAdminDevStorageFallback()) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'GitHub token missing for this JSON resource (production). Set NUXT_AUTOADMIN_GITHUB_TOKEN / runtimeConfig.autoadmin.github.token, or use local storage.',
    })
  }

  const mirrorPath = githubDevMirrorAbsolutePath(storage)
  return new LocalJsonRepository({
    absolutePath: mirrorPath,
    defaultIfMissing: defaultParsedForKind(resourceKind),
  })
}
