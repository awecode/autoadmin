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
  return resolve(process.cwd(), '.data', 'json-admin')
}

/** Resolve a path relative to `jsonAdmin.localRoot`, or an absolute filesystem path. */
export function resolveLocalJsonAdminPath(pathInput: string): string {
  if (pathInput.startsWith('/') || /^[A-Z]:[\\/]/i.test(pathInput)) {
    return resolve(pathInput)
  }
  return resolve(join(jsonAdminLocalRoot(), pathInput))
}

export function resolveGithubTokenForStorage(token?: string): string | undefined {
  const t = (token || '').trim()
  if (t) {
    return t
  }
  const config = useRuntimeConfig() as {
    github?: { token?: string }
    autoadmin?: { github?: { token?: string } }
  }
  const fromEnv = (config.github?.token || config.autoadmin?.github?.token || '').trim()
  return fromEnv || undefined
}

/**
 * When GitHub token is missing, allow a local mirror only outside production builds.
 * Uses `import.meta.dev` (Nuxt) and `NODE_ENV !== 'production'`.
 */
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

/** GitHub Contents when a token exists; otherwise local mirror under `_github_dev/...` in dev or 500 in production. */
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
    })
  }

  if (!isJsonAdminDevStorageFallback()) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'GitHub token missing for this JSON resource (production). Set NUXT_GITHUB_TOKEN / runtimeConfig.github.token, or use local storage.',
    })
  }

  const mirrorPath = githubDevMirrorAbsolutePath(storage)
  return new LocalJsonRepository({
    absolutePath: mirrorPath,
    defaultIfMissing: defaultParsedForKind(resourceKind),
  })
}
