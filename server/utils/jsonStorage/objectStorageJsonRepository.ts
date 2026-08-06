import type { JsonStorageReadResult, JsonStorageRepository, JsonStorageWriteInput } from './types'
import { getObjectStorageBackend } from '../objectStorage'
import { r2Backend } from '../r2'
import { s3Backend } from '../s3'

export interface ObjectStorageJsonRepositoryOptions {
  objectKey: string
  /** When the object does not exist yet, `read` returns this as `parsed` and revision `'0'`. */
  defaultIfMissing: unknown
}

export class ObjectStorageJsonRepository implements JsonStorageRepository {
  readonly adapterKind = 'object-storage' as const

  constructor(private readonly opts: ObjectStorageJsonRepositoryOptions) {}

  async read(): Promise<JsonStorageReadResult> {
    const result = await this.getText()
    if (!result) {
      return {
        parsed: structuredClone(this.opts.defaultIfMissing),
        revision: '0',
      }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(result.body) as unknown
    }
    catch {
      throw createError({
        statusCode: 422,
        statusMessage: 'Object storage JSON is not valid JSON.',
      })
    }
    return { parsed, revision: result.etag }
  }

  async write(input: JsonStorageWriteInput): Promise<void> {
    const putOptions = input.revision === '0'
      ? { ifNoneMatch: '*' as const, contentType: 'application/json' }
      : { ifMatch: input.revision, contentType: 'application/json' }

    const status = await this.putText(input.bodyUtf8, putOptions)

    if (status === 'precondition-failed') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Object storage JSON changed. Refresh and try again.',
      })
    }
  }

  private async getText() {
    const backend = getObjectStorageBackend()
    if (backend.name === 'r2-binding') {
      return r2Backend.getText(r2Backend.getClient(), this.opts.objectKey)
    }
    return s3Backend.getText(s3Backend.getClient(), this.opts.objectKey)
  }

  private async putText(
    body: string,
    options: { ifMatch?: string, ifNoneMatch?: string, contentType?: string },
  ) {
    const backend = getObjectStorageBackend()
    if (backend.name === 'r2-binding') {
      return r2Backend.putText(r2Backend.getClient(), this.opts.objectKey, body, options)
    }
    return s3Backend.putText(s3Backend.getClient(), this.opts.objectKey, body, options)
  }
}
