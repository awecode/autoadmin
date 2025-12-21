import { Buffer } from 'node:buffer'
import process from 'node:process'

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

  getPublicUrl: () => {
    const config = useRuntimeConfig()
    let publicUrl = (config.publicR2Url as string) || config.s3?.publicUrl || ''
    if (!publicUrl.endsWith('/')) {
      publicUrl = `${publicUrl}/`
    }
    return publicUrl
  },

  put: async (binding: R2Binding, path: string, body: BodyInit, headers: Record<string, string>) => {
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

    const result = await binding.put(path, fileBody, {
      httpMetadata: Object.keys(httpMetadata).length > 0 ? httpMetadata : undefined,
    })

    if (!result) {
      throw new Error('Error uploading file to R2: Upload returned null')
    }
  },
}
