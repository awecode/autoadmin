import type { Buffer } from 'node:buffer'
import { Crypto } from '@peculiar/webcrypto'

import { AwsClient } from 'aws4fetch'

import { v4 as uuid } from 'uuid'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = new Crypto()
}

const inlineTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']

export default async function uploadToObjectStorage(file: Buffer | File, extension: string = 'jpeg', fileType?: string, prefix?: string) {
  const { s3 } = useRuntimeConfig()
  if (!s3.accessKey || !s3.secretKey || !s3.bucketName || !s3.endpointUrl || !s3.region) {
    throw new Error('Object storage is not configured correctly. Please check your environment variables.')
  }
  const client = new AwsClient({
    accessKeyId: s3.accessKey,
    secretAccessKey: s3.secretKey,
    service: 's3',
    region: s3.region,
  })

  if (prefix && prefix.endsWith('/')) {
    prefix = prefix.slice(0, -1)
  }

  let filename = prefix ? `${prefix}/${uuid()}` : uuid()

  filename = `${filename}.${extension}`

  if (filename.startsWith('/')) {
    filename = filename.slice(1)
  }

  const url = `${s3.endpointUrl}/${s3.bucketName}`

  const headers: Record<string, string> = {
    'X-Amz-Acl': 'public-read',
  }

  if (fileType && inlineTypes.includes(fileType)) {
    headers['Content-Type'] = fileType
    headers['Content-Disposition'] = 'inline'
  }

  const request = await client.sign(`${url}/${filename}`, {
    method: 'PUT',
    body: file,
    headers,
  })

  const response = await fetch(request)

  let publicUrl = s3.publicUrl || ''
  if (publicUrl.endsWith('/')) {
    publicUrl = publicUrl.slice(0, -1)
  }

  if (response.ok) {
    return `${publicUrl}/${filename}`
  } else {
    throw new Error(`Error uploading file to object storage: ${response.statusText}`)
  }
}
