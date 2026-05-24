import type { JsonStorageRepository } from './types'

export interface WriteJsonStorageWithRetryInput {
  mutator: (parsed: unknown) => unknown
  bodyUtf8: (parsed: unknown) => string
  /** Optional commit message (GitHub only). Omitted → adapter default. */
  message?: string
}

/**
 * Read → mutate → write with a single 409 retry on concurrent edit.
 */
export async function writeJsonStorageWithRetry(
  repo: JsonStorageRepository,
  input: WriteJsonStorageWithRetryInput,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { parsed, revision } = await repo.read()
      const next = input.mutator(parsed)
      await repo.write({
        bodyUtf8: input.bodyUtf8(next),
        revision,
        message: input.message,
      })
      return
    }
    catch (e: any) {
      if (e?.statusCode === 409 && attempt === 0) {
        continue
      }
      throw e
    }
  }
}

export function formatJsonFileBody(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`
}
