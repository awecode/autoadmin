import type { JsonStorageConfig } from './factory'
import {
  getAutoadminGithubRuntime,
  isJsonAdminDevStorageFallback,
  resolveGithubTokenForStorage,
  resolveLocalJsonAdminPath,
} from './factory'

/** Subset of `register()` input used to build `JsonStorageConfig`. */
export interface JsonStorageFromRegister {
  /** Repo-relative path for GitHub, or filesystem path (under `runtimeConfig.autoadmin.jsonLocalRoot` / absolute) for local. */
  path?: string
  storage?: JsonStorageRegisterDiscriminated
  /**
   * Optional override for the GitHub token when using `storage.kind: 'github'`.
   * Prefer **`NUXT_AUTOADMIN_GITHUB_TOKEN`** / `runtimeConfig.autoadmin.github.token` and omit this.
   * If you need an override, read it from environment (or a secret manager) at startup — do not hardcode.
   */
  githubToken?: string
}

/**
 * `local` — JSON file at top-level `path`.
 * `github` — repo-relative file path is **only** the register top-level `path`; **`ref`** is the branch or tag for the Contents API (`?ref=`). **`owner` / `repo` / `ref`** may be omitted when set globally (`NUXT_AUTOADMIN_GITHUB_OWNER`, `NUXT_AUTOADMIN_GITHUB_REPO`, `NUXT_AUTOADMIN_GITHUB_REF`).
 */
export type JsonStorageRegisterDiscriminated
  = | {
    kind: 'github'
    owner?: string
    repo?: string
    ref?: string
    /**
     * Per-resource GitHub token. Prefer **`NUXT_AUTOADMIN_GITHUB_TOKEN`** / `runtimeConfig.autoadmin.github.token`.
     * Use only when this resource needs a different credential; load from environment at runtime.
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

function firstNonemptyString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    const t = trimPath(c)
    if (t) {
      return t
    }
  }
  return undefined
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
    const rt = getAutoadminGithubRuntime()
    const owner = firstNonemptyString(s.owner, rt.owner)
    const repo = firstNonemptyString(s.repo, rt.repo)
    const ref = firstNonemptyString(s.ref, rt.ref)
    if (!filePath) {
      throw new Error(
        `JSON admin "${resourceKey}": Storage requires top-level \`path\` (repo-relative JSON file).`,
      )
    }
    const resolvedToken = resolveGithubTokenForStorage(s.token ?? input.githubToken)
    if (!resolvedToken) {
      return {
        kind: 'local',
        absolutePath: resolveLocalJsonAdminPath(filePath),
      }
    }
    if (!owner) {
      throw new Error(
        `JSON admin "${resourceKey}": GitHub \`owner\` missing — set storage.owner or NUXT_AUTOADMIN_GITHUB_OWNER / runtimeConfig.autoadmin.github.owner.`,
      )
    }
    if (!repo) {
      throw new Error(
        `JSON admin "${resourceKey}": GitHub \`repo\` missing — set storage.repo or NUXT_AUTOADMIN_GITHUB_REPO / runtimeConfig.autoadmin.github.repo.`,
      )
    }
    if (!ref) {
      throw new Error(
        `JSON admin "${resourceKey}": GitHub \`ref\` missing — set storage.ref or NUXT_AUTOADMIN_GITHUB_REF / runtimeConfig.autoadmin.github.ref.`,
      )
    }
    return {
      kind: 'github',
      owner,
      repo,
      path: filePath,
      ref,
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
    `JSON admin "${resourceKey}": set top-level \`path\` and \`storage: { kind: 'local' } | { kind: 'github', owner?, repo?, ref? }\` (or set owner/repo/ref globally via runtimeConfig.autoadmin.github / NUXT_AUTOADMIN_GITHUB_*).`,
  )
}
