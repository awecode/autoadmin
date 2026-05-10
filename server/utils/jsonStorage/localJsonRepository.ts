import type { JsonStorageReadResult, JsonStorageRepository, JsonStorageWriteInput } from './types'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface LocalJsonRepositoryOptions {
  absolutePath: string
  /** When the file does not exist yet, `read` returns this as `parsed` and revision `'0'`. */
  defaultIfMissing: unknown
}

export class LocalJsonRepository implements JsonStorageRepository {
  readonly adapterKind = 'local' as const

  constructor(private readonly opts: LocalJsonRepositoryOptions) {}

  async read(): Promise<JsonStorageReadResult> {
    try {
      const [raw, st] = await Promise.all([
        readFile(this.opts.absolutePath, 'utf8'),
        stat(this.opts.absolutePath),
      ])
      let parsed: unknown
      try {
        parsed = JSON.parse(raw) as unknown
      }
      catch {
        throw createError({
          statusCode: 422,
          statusMessage: 'Local JSON file is not valid JSON.',
        })
      }
      return { parsed, revision: String(st.mtimeMs) }
    }
    catch (e: any) {
      if (e?.code === 'ENOENT') {
        return { parsed: structuredClone(this.opts.defaultIfMissing), revision: '0' }
      }
      throw e
    }
  }

  async write(input: JsonStorageWriteInput): Promise<void> {
    const dir = dirname(this.opts.absolutePath)
    await mkdir(dir, { recursive: true })

    let currentMtime: string | undefined
    try {
      const st = await stat(this.opts.absolutePath)
      currentMtime = String(st.mtimeMs)
    }
    catch (e: any) {
      if (e?.code !== 'ENOENT') {
        throw e
      }
    }

    if (currentMtime !== undefined && input.revision !== '0' && currentMtime !== input.revision) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Local JSON file changed on disk. Refresh and try again.',
      })
    }

    if (currentMtime === undefined && input.revision !== '0') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Local JSON file was created concurrently. Refresh and try again.',
      })
    }

    await writeFile(this.opts.absolutePath, input.bodyUtf8, 'utf8')
  }
}
