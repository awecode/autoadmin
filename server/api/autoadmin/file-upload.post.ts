import { z } from 'zod'
import uploadToObjectStorage from '../../utils/objectStorage'

export default defineEventHandler(async (event) => {
  const contentType = getRequestHeader(event, 'content-type')

  const query = await getValidatedQuery(event, z.object({
    prefix: z.string().optional(),
    fileType: z.string().optional(),
  }).parse)

  if (!contentType?.startsWith('multipart/form-data')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The request must be multipart/form-data',
    })
  }
  const parts = await readMultipartFormData(event) || []
  if (parts.length !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The request must contain exactly one file',
    })
  }
  const part = parts[0]!
  if (!part.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid file',
    })
  }

  let url: string
  try {
    url = await uploadToObjectStorage(part.data, {
      extension: part.filename?.split('.').pop() || 'bin',
      filename: part.filename,
      fileType: query.fileType,
      prefix: query.prefix,
    })
  }
  catch (error: any) {
    if (error?.message?.includes('Invalid storage path segment')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file path',
      })
    }
    throw error
  }

  return url
})
