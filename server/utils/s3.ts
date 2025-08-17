import type { Buffer } from 'node:buffer'
import { Crypto } from '@peculiar/webcrypto'

import { AwsClient } from 'aws4fetch'

import { v4 as uuid } from 'uuid'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = new Crypto()
}

const USE_UUID_FILENAMES = false
const OVERWRITE_FILENAME = false

const checkIfFileExists = async (client: AwsClient, path: string) => {
  const request = await client.sign(path, {
    method: 'GET',
  })
  const response = await fetch(request)
  if (response.status === 404 || response.status === 403) {
    return false
  }
  return response.ok
}

const inlineTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']

export default async function uploadToObjectStorage(file: Buffer | File, config?: {
  extension?: string
  filename?: string
  fileType?: string
  prefix?: string
}) {
  const { s3 } = useRuntimeConfig()
  const s3Config = s3 as any
  if (!s3Config.accessKey || !s3Config.secretKey || !s3Config.bucketName || !s3Config.endpointUrl || !s3Config.region) {
    throw new Error('Object storage is not configured correctly. Please check your environment variables.')
  }
  const client = new AwsClient({
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
    service: 's3',
    region: s3Config.region,
  })

  const url = `${s3Config.endpointUrl}/${s3Config.bucketName}`

  const prefix = config?.prefix ? (config.prefix.endsWith('/') ? config.prefix : `${config.prefix}/`) : ''

  let fullFileName: string
  if (config?.filename && !USE_UUID_FILENAMES) {
    const baseFileName = prefix ? `${prefix}${config.filename}` : config.filename
    fullFileName = baseFileName

    if (!OVERWRITE_FILENAME) {
      // Check if file exists and find available filename with incremental numbers
      let counter = 0
      let testFileName = fullFileName

      if (!testFileName.startsWith('/')) {
        testFileName = `/${testFileName}`
      }

      let fileExists = await checkIfFileExists(client, `${url}${testFileName}`)

      while (fileExists) {
        counter++

        // Split filename and extension
        const lastDotIndex = baseFileName.lastIndexOf('.')
        if (lastDotIndex > 0) {
          const nameWithoutExt = baseFileName.substring(0, lastDotIndex)
          const extension = baseFileName.substring(lastDotIndex)
          fullFileName = `${nameWithoutExt}-${counter}${extension}`
        } else {
          fullFileName = `${baseFileName}-${counter}`
        }

        testFileName = fullFileName.startsWith('/') ? fullFileName : `/${fullFileName}`
        fileExists = await checkIfFileExists(client, `${url}${testFileName}`)
      }
    }
  } else {
    const filename = uuid()
    fullFileName = prefix ? `${prefix}${filename}` : filename
    if (config?.extension) {
      fullFileName = `${fullFileName}.${config.extension}`
    }
  }

  if (!fullFileName.startsWith('/')) {
    fullFileName = `/${fullFileName}`
  }

  const headers: Record<string, string> = {
    'X-Amz-Acl': 'public-read',
  }

  if (config?.fileType && inlineTypes.includes(config.fileType)) {
    headers['Content-Type'] = config.fileType
    headers['Content-Disposition'] = 'inline'
  }

  const request = await client.sign(`${url}${fullFileName}`, {
    method: 'PUT',
    body: file as unknown as BodyInit,
    headers,
  })

  const response = await fetch(request)

  let publicUrl = s3Config.publicUrl || ''
  if (publicUrl.endsWith('/')) {
    publicUrl = publicUrl.slice(0, -1)
  }

  if (response.ok) {
    return `${publicUrl}${fullFileName}`
  } else {
    throw new Error(`Error uploading file to object storage: ${response.statusText}`)
  }
}
