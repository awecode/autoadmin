import { Buffer } from 'node:buffer'
import process from 'node:process'
import { encodeObjectKeyForUrl } from './objectStorage'

export interface R2Binding {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: {
    httpMetadata?: HeadersInit
    customMetadata?: Record<string, string>
  }) => Promise<Record<string, unknown> | null>
  get: (key: string, options?: {
    onlyIf?: HeadersInit
    range?: HeadersInit
  }) => Promise<Record<string, unknown> | null>
  delete: (keys: string | string[]) => Promise<void>
}

export const r2Backend = {
  name: 'r2-binding',
  getClient: () => {
    // @ts-expect-error - globalThis is not typed
    const binding = process.env.R2 || globalThis.__env__?.R2 || globalThis.R2
    if (!binding) {
      throw new Error('R2 bucket binding is required. Make sure the bucket is bound to your Worker.')
    }
    return binding
  },

  checkIfFileExists: async (binding: R2Binding, key: string): Promise<boolean> => {
    const object = await binding.get(key)
    return object !== null
  },

  getPublicUrl: (path?: string) => {
    const config = useRuntimeConfig()
    let publicUrl = (config.r2PublicUrl as string) || config.s3?.publicUrl || ''
    if (!publicUrl.endsWith('/')) {
      publicUrl = `${publicUrl}/`
    }
    if (path) {
      publicUrl = `${publicUrl}${encodeObjectKeyForUrl(path)}`
    }
    return publicUrl
  },

  put: async (binding: R2Binding, path: string, body: BodyInit | ReadableStream, headers: Record<string, string>) => {
    // Convert file to appropriate format for R2
    let fileBody: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob
    if (body instanceof ReadableStream || typeof body === 'string' || body instanceof Blob) {
      fileBody = body
    }
    else if (Buffer.isBuffer(body)) {
    // Convert Buffer to Uint8Array for R2
      fileBody = new Uint8Array(body)
    }
    else {
      fileBody = body as unknown as Blob
    }

    const httpMetadata: Record<string, string> = {}
    const customMetadata: Record<string, string> = {}

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase()
        // https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#http-metadata
        if (lowerKey === 'content-type') {
          httpMetadata.contentType = value
        }
        else if (lowerKey === 'content-disposition') {
          httpMetadata.contentDisposition = value
        }
        else if (lowerKey === 'content-language') {
          httpMetadata.contentLanguage = value
        }
        else if (lowerKey === 'content-encoding') {
          httpMetadata.contentEncoding = value
        }
        else if (lowerKey === 'cache-control') {
          httpMetadata.cacheControl = value
        }
        else if (lowerKey === 'cache-expiry') {
          httpMetadata.cacheControl = value
        }
        else {
          // Everything else (like X-Amz-Acl) goes to customMetadata
          customMetadata[key] = value
        }
      })
    }

    const options: any = {}
    if (Object.keys(httpMetadata).length > 0)
      options.httpMetadata = httpMetadata
    if (Object.keys(customMetadata).length > 0)
      options.customMetadata = customMetadata

    /*
    In Cloudflare Workers, we may not be able to upload large files directly without streaming
    due to memory limits.

    Not using FixedLengthStream results in the error:
    "Provided readable stream must have a known length (request/response body or readable half of FixedLengthStream)"

    FixedLengthStream is available in Cloudflare Workers, and we use it when possible.
    https://github.com/cloudflare/workers-sdk/issues/6425

    In emulated environments where the R2 binding works but is not a real Worker runtime
    (for example Nitro's emulation), we convert the stream to a buffer and upload it instead.
    */

    // @ts-expect-error - FixedLengthStream is not typed in Node environment
    if (headers['Content-Length'] && fileBody instanceof ReadableStream && typeof FixedLengthStream !== 'undefined') {
      // @ts-expect-error - FixedLengthStream is not typed in Node environment
      const { readable, writable } = new FixedLengthStream(Number(headers['Content-Length']),
      )
      fileBody.pipeTo(writable)
      const result = await binding.put(path, readable, options)
      if (!result) {
        throw new Error('Error uploading file to R2.')
      }
    }
    else {
      if (fileBody instanceof ReadableStream) {
        const response = new Response(fileBody)
        const buffer = await response.arrayBuffer()
        fileBody = buffer
      }
      const result = await binding.put(path, fileBody, options)
      if (!result) {
        throw new Error('Error uploading file to R2.')
      }
    }
  },
}
