import { Buffer } from 'node:buffer'
import process from 'node:process'

function normalizeKey(key: string): string {
  return key.startsWith('/') ? key.slice(1) : key
}

// R2 Bucket binding interface (Cloudflare Workers)
// Based on: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
export interface R2Bucket {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: {
    httpMetadata?: HeadersInit
    customMetadata?: Record<string, string>
  }) => Promise<R2Object | null>
  get: (key: string, options?: {
    onlyIf?: HeadersInit
    range?: HeadersInit
  }) => Promise<R2ObjectBody | null>
  delete: (keys: string | string[]) => Promise<void>
}

interface R2Object {
  key: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  checksums: R2Checksums
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
  bodyUsed: boolean
}

interface R2Checksums {
  md5?: ArrayBuffer
  sha1?: ArrayBuffer
  sha256?: ArrayBuffer
  sha384?: ArrayBuffer
  sha512?: ArrayBuffer
}

interface R2HTTPMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
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

  getUrl: () => {
    return ''
  },

  checkIfFileExists: async (bucket: R2Bucket, key: string): Promise<boolean> => {
    const object = await bucket.get(key)
    return object !== null
  },

  getPublicUrl: () => {
    const { s3 } = useRuntimeConfig()
    let publicUrl = s3.publicUrl || ''
    if (publicUrl.endsWith('/')) {
      publicUrl = publicUrl.slice(0, -1)
    }
    return publicUrl
  },

  put: async (bucket: R2Bucket, path: string, body: BodyInit, headers: Record<string, string>) => {
    // Upload to R2 using binding API
  // Reference: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/

    // Convert file to appropriate format for R2
    let fileBody: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob
    if (body instanceof File) {
      fileBody = body
    } else if (Buffer.isBuffer(body)) {
    // Convert Buffer to Uint8Array for R2
      fileBody = new Uint8Array(body)
    } else {
      fileBody = body as unknown as Blob
    }

    const httpMetadata: Headers = new Headers()
    if (Object.keys(headers).length > 0) {
      Object.entries(headers).forEach(([key, value]) => {
        httpMetadata.set(key, value)
      })
    }
    const r2Key = normalizeKey(path)
    const result = await bucket.put(r2Key, fileBody, {
      httpMetadata: Object.keys(httpMetadata).length > 0 ? httpMetadata : undefined,
    })

    if (!result) {
      throw new Error('Error uploading file to R2: Upload returned null')
    }
    return true
  },
}
