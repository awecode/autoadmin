import type { GithubFilePayload } from '../githubContents'
import type { JsonStorageReadResult, JsonStorageRepository, JsonStorageWriteInput } from './types'
import { Buffer } from 'node:buffer'
import { getGithubJsonFile, putGithubJsonFile } from '../githubContents'

export interface GithubJsonRepositoryOptions {
  token: string
  owner: string
  repo: string
  path: string
  ref?: string
  /** When the path has no file yet (404), `read` returns this as `parsed` and revision `'0'` (same as local). */
  defaultIfMissing: unknown
}

export class GithubJsonRepository implements JsonStorageRepository {
  readonly adapterKind = 'github' as const

  constructor(private readonly opts: GithubJsonRepositoryOptions) {}

  async read(): Promise<JsonStorageReadResult> {
    try {
      const { parsed, sha } = await getGithubJsonFile(
        this.opts.token,
        this.opts.owner,
        this.opts.repo,
        this.opts.path,
        this.opts.ref,
      )
      return { parsed, revision: sha }
    }
    catch (e: any) {
      if (e?.statusCode === 404) {
        return {
          parsed: structuredClone(this.opts.defaultIfMissing),
          revision: '0',
        }
      }
      throw e
    }
  }

  async write(input: JsonStorageWriteInput): Promise<void> {
    const content = Buffer.from(input.bodyUtf8, 'utf8').toString('base64')
    const payload: GithubFilePayload = {
      message: input.message || 'Update JSON',
      content,
    }
    if (this.opts.ref) {
      payload.branch = this.opts.ref
    }
    if (input.revision && input.revision !== '0') {
      payload.sha = input.revision
    }
    await putGithubJsonFile(
      this.opts.token,
      this.opts.owner,
      this.opts.repo,
      this.opts.path,
      payload,
    )
  }
}
