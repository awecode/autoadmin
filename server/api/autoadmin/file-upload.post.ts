import uploadToObjectStorage from '#layers/autoadmin/server/utils/s3'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const contentType = getRequestHeader(event, 'content-type')

  const query = await getValidatedQuery(event, z.object({
    folder: z.string().optional(),
  }).parse)

  if (!contentType?.startsWith('multipart/form-data')) {
    createError({
      statusCode: 400,
      message: 'The request must be multipart/form-data',
    })
  }
  const parts = await readMultipartFormData(event) || []
  if (parts.length !== 1) {
    createError({
      statusCode: 400,
      message: 'The request must contain exactly one file',
    })
  }
  if (parts[0].name !== 'file' && !parts[0].filename) {
    createError({
      statusCode: 400,
      message: 'The file must be named "file"',
    })
  }

  const url = await uploadToObjectStorage(parts[0].data, parts[0].filename?.split('.').pop() || 'bin', query.folder)

  return url
})
