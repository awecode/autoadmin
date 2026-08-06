import { AwsClient } from 'aws4fetch'
import { encodeObjectKeyForUrl, normalizeObjectStorageEtag } from './objectStorage'

export interface ObjectStorageGetTextResult {
  body: string
  etag: string
}

export type ObjectStoragePutTextResult = 'ok' | 'precondition-failed'

function objectStorageRequestUrl(objectKey: string): string {
  const { s3 } = useRuntimeConfig()
  const base = `${s3.endpointUrl}/${s3.bucketName}`
  const encodedKey = encodeObjectKeyForUrl(objectKey)
  return encodedKey ? `${base}/${encodedKey}` : base
}

export const s3Backend = {
  name: 's3',
  getClient: () => {
    const { s3 } = useRuntimeConfig()
    const s3Config = s3
    if (!s3Config.accessKey || !s3Config.secretKey || !s3Config.bucketName || !s3Config.endpointUrl || !s3Config.region) {
      throw new Error('Object storage is not configured correctly. Please check your environment variables.')
    }
    return new AwsClient({
      accessKeyId: s3Config.accessKey,
      secretAccessKey: s3Config.secretKey,
      service: 's3',
      region: s3Config.region,
    })
  },

  checkIfFileExists: async (client: AwsClient, path: string) => {
    const request = await client.sign(objectStorageRequestUrl(path), {
      method: 'GET',
    })
    const response = await fetch(request)
    if (response.status === 404 || response.status === 403) {
      return false
    }
    return response.ok
  },

  getText: async (client: AwsClient, path: string): Promise<ObjectStorageGetTextResult | null> => {
    const request = await client.sign(objectStorageRequestUrl(path), {
      method: 'GET',
    })
    const response = await fetch(request)
    if (response.status === 404 || response.status === 403) {
      return null
    }
    if (!response.ok) {
      throw new Error(`Error reading object storage object: ${response.statusText}`)
    }
    const etag = normalizeObjectStorageEtag(response.headers.get('etag'))
    if (!etag) {
      throw new Error('Object storage GET response missing ETag.')
    }
    return {
      body: await response.text(),
      etag,
    }
  },

  getPublicUrl: (path?: string) => {
    const { s3 } = useRuntimeConfig()
    let publicUrl = s3.publicUrl || ''
    if (!publicUrl.endsWith('/')) {
      publicUrl = `${publicUrl}/`
    }
    if (path) {
      publicUrl = `${publicUrl}${encodeObjectKeyForUrl(path)}`
    }
    return publicUrl
  },

  put: async (client: AwsClient, path: string, body: BodyInit | ReadableStream, headers: Record<string, string>) => {
    const requestHeaders: Record<string, string> = { ...headers }
    requestHeaders['x-amz-content-sha256'] = 'UNSIGNED-PAYLOAD'
    const request = await client.sign(objectStorageRequestUrl(path), {
      method: 'PUT',
      body,
      headers: requestHeaders,
    })
    const response = await fetch(request, {
      // @ts-expect-error - Probably required by Node.js 18+ native fetch when sending a ReadableStream body
      duplex: 'half',
    })
    if (!response.ok) {
      throw new Error(`Error uploading file to object storage: ${response.statusText}`)
    }
  },

  putText: async (
    client: AwsClient,
    path: string,
    body: string,
    options?: { ifMatch?: string, ifNoneMatch?: string, contentType?: string },
  ): Promise<ObjectStoragePutTextResult> => {
    const bodyBytes = new TextEncoder().encode(body)
    const requestHeaders: Record<string, string> = {
      'Content-Type': options?.contentType ?? 'application/json',
      'Content-Length': String(bodyBytes.byteLength),
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    }
    if (options?.ifMatch) {
      requestHeaders['If-Match'] = `"${options.ifMatch}"`
    }
    if (options?.ifNoneMatch) {
      requestHeaders['If-None-Match'] = options.ifNoneMatch
    }
    const request = await client.sign(objectStorageRequestUrl(path), {
      method: 'PUT',
      body,
      headers: requestHeaders,
    })
    const response = await fetch(request)
    if (response.status === 412) {
      return 'precondition-failed'
    }
    if (!response.ok) {
      throw new Error(`Error writing object storage object: ${response.statusText}`)
    }
    return 'ok'
  },
}
