import type { JsonStorageConfig } from './factory'
import {
  isJsonAdminDevStorageFallback,
  resolveGithubTokenForStorage,
  resolveLocalJsonAdminPath,
} from './factory'

/** Subset of `register()` input used to build `JsonStorageConfig`. */
export interface JsonStorageFromRegister {
  /** Repo-relative path for GitHub, or filesystem path (under `jsonAdmin.localRoot` / absolute) for local. */
  path?: string
  storage?: JsonStorageRegisterDiscriminated
  /**
   * Optional override for the GitHub token when using `storage.kind: 'github'`.
   * Prefer the **global** server env token and omit this. If you need an override,
   * read it from environment (or a secret manager) at startup — do not hardcode.
   */
  githubToken?: string
}

/**
 * `local` — JSON file at top-level `path`.
 * `github` — same `path` is the file path inside the repo; **`ref`** is the branch or tag for the Contents API (`?ref=`).
 */
export type JsonStorageRegisterDiscriminated
  = | {
    kind: 'github'
    owner: string
    repo: string
    ref: string
    /**
     * Per-resource GitHub token. Prefer the **global** env-based token and omit this.
     * Use only when this resource needs a different credential; load from environment
     * or server-side secrets at runtime — never hardcode in server source.
     */
    token?: string
  }
  | { kind: 'local' }

function trimPath(p: unknown): string | undefined {
  if (p == null) {
    return undefined
  }
  const s = String(p).trim()
  return s || undefined
}

export function buildJsonStorageConfig(input: JsonStorageFromRegister, resourceKey: string): JsonStorageConfig {
  const filePath = trimPath(input.path)

  if (input.storage?.kind === 'local') {
    if (!filePath) {
      throw new Error(`JSON admin "${resourceKey}": local storage requires top-level \`path\`.`)
    }
    return {
      kind: 'local',
      absolutePath: resolveLocalJsonAdminPath(filePath),
    }
  }

  if (input.storage?.kind === 'github') {
    const s = input.storage
    if (!filePath) {
      throw new Error(`JSON admin "${resourceKey}": GitHub storage requires top-level \`path\` (file in repo).`)
    }
    const token = resolveGithubTokenForStorage(s.token ?? input.githubToken)
    if (!token && isJsonAdminDevStorageFallback()) {
      return {
        kind: 'local',
        absolutePath: resolveLocalJsonAdminPath(filePath),
      }
    }
    return {
      kind: 'github',
      owner: s.owner,
      repo: s.repo,
      path: filePath,
      ref: s.ref,
      token: s.token ?? input.githubToken,
    }
  }

  if (filePath && input.storage == null) {
    if (!isJsonAdminDevStorageFallback()) {
      throw new Error(`JSON admin "${resourceKey}": lone \`path\` is dev-only; set \`storage\`.`)
    }
    return {
      kind: 'local',
      absolutePath: resolveLocalJsonAdminPath(filePath),
    }
  }

  throw new Error(
    `JSON admin "${resourceKey}": set top-level \`path\` and \`storage: { kind: 'local' } | { kind: 'github', owner, repo, ref }\`.`,
  )
}
