import type { Buffer } from 'node:buffer'
import { Crypto } from '@peculiar/webcrypto'

import { AwsClient } from 'aws4fetch'

import { v4 as uuid } from 'uuid'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = new Crypto()
}

const inlineTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']

export default async function uploadToObjectStorage(file: Buffer | File, config: {
  extension?: string
  filename?: string
  fileType?: string
  prefix?: string
}) {
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

  const prefix = config.prefix ? (config.prefix.endsWith('/') ? config.prefix : `${config.prefix}/`) : ''

  let fullFileName: string
  if (config.filename) {
    fullFileName = prefix ? `${prefix}${config.filename}` : config.filename
  } else {
    const filename = uuid()
    fullFileName = prefix ? `${prefix}${filename}` : filename
    if (config.extension) {
      fullFileName = `${fullFileName}.${config.extension}`
    }
  }

  if (!fullFileName.startsWith('/')) {
    fullFileName = `/${fullFileName}`
  }

  const url = `${s3.endpointUrl}/${s3.bucketName}`

  const headers: Record<string, string> = {
    'X-Amz-Acl': 'public-read',
  }

  if (config.fileType && inlineTypes.includes(config.fileType)) {
    headers['Content-Type'] = config.fileType
    headers['Content-Disposition'] = 'inline'
  }

  console.log(`${url}${fullFileName}`, fullFileName)

  const request = await client.sign(`${url}${fullFileName}`, {
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
    return `${publicUrl}${fullFileName}`
  } else {
    throw new Error(`Error uploading file to object storage: ${response.statusText}`)
  }
}
