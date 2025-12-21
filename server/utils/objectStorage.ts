import type { Buffer as NodeBuffer } from 'node:buffer'
import process from 'node:process'
import { Crypto } from '@peculiar/webcrypto'
import { v4 as uuid } from 'uuid'
import { r2Backend } from './r2'
import { s3Backend } from './s3'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = new Crypto()
}

const normalizePath = (path: string): string => {
  // remove leading and trailing slashes
  return path.replace(/^\/+|\/+$/g, '')
}

const USE_UUID_FILENAMES = false
const OVERWRITE_FILENAME = false

const inlineTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']

export default async function uploadToObjectStorage(file: NodeBuffer | File, config?: {
  extension?: string
  filename?: string
  fileType?: string
  prefix?: string
}) {
  // @ts-expect-error - globalThis is not typed
  const binding = process.env.R2 || globalThis.__env__?.R2 || globalThis.R2
  const backend = binding ? r2Backend : s3Backend
  const client = backend.getClient()

  const prefix = normalizePath(config?.prefix || '')

  let fullFileName: string
  if (config?.filename && !USE_UUID_FILENAMES) {
    const filename = normalizePath(config.filename)
    const baseFileName = prefix ? `${prefix}/${filename}` : filename
    fullFileName = baseFileName

    if (!OVERWRITE_FILENAME) {
      // Check if file exists and find available filename with incremental numbers
      let counter = 0
      let testFileName = fullFileName

      let fileExists = await backend.checkIfFileExists(client, testFileName)

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

        testFileName = fullFileName
        fileExists = await backend.checkIfFileExists(client, testFileName)
      }
    }
  } else {
    const filename = uuid()
    fullFileName = prefix ? `${prefix}/${filename}` : filename
    if (config?.extension) {
      fullFileName = `${fullFileName}.${config.extension}`
    }
  }

  const headers: Record<string, string> = {
    'X-Amz-Acl': 'public-read',
  }

  if (config?.fileType && inlineTypes.includes(config.fileType)) {
    headers['Content-Type'] = config.fileType
    headers['Content-Disposition'] = 'inline'
  }

  await backend.put(client, fullFileName, file as unknown as BodyInit, headers)
  return `${backend.getPublicUrl()}${fullFileName}`
}
