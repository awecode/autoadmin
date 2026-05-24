import type { JsonStorageFromRegister } from '#layers/autoadmin/server/utils/jsonStorage/normalizeRegisterStorage'
import { createJsonStorageRepository } from '#layers/autoadmin/server/utils/jsonStorage/factory'
import { buildJsonStorageConfig } from '#layers/autoadmin/server/utils/jsonStorage/normalizeRegisterStorage'
import { formatJsonFileBody, writeJsonStorageWithRetry } from '#layers/autoadmin/server/utils/jsonStorage/writeWithRetry'

/** `path` + `storage` (same as JSON admin `register()`); optional GitHub commit message. */
export type JsonFileTarget = JsonStorageFromRegister & {
  commitMessage?: string
}

/** Set one top-level key on a JSON object file (read → patch → write, 409 retry). */
export async function patchJsonKey(
  target: JsonFileTarget,
  key: string,
  value: unknown,
): Promise<void> {
  const { commitMessage, ...storageInput } = target
  const storage = buildJsonStorageConfig(storageInput, 'json-file')
  const repo = createJsonStorageRepository(storage, 'object')
  await writeJsonStorageWithRetry(repo, {
    mutator: (parsed) => {
      const base = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? { ...(parsed as Record<string, unknown>) }
        : {}
      base[key] = value
      return base
    },
    bodyUtf8: formatJsonFileBody,
    message: commitMessage?.trim() || undefined,
  })
}
