import { assertRoleAccessAllowed } from '#autoadmin/roleAccess'
import { z } from 'zod'
import { getModelConfig } from '../../utils/autoadmin'
import uploadToObjectStorage from '../../utils/objectStorage'

export default defineEventHandler(async (event) => {
  const stream = getRequestWebStream(event)

  if (!stream) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file body provided in the request',
    })
  }

  const contentLength = getRequestHeader(event, 'content-length')

  const query = await getValidatedQuery(event, z.object({
    prefix: z.string().optional(),
    fileType: z.string().optional(),
    fileName: z.string().min(1, 'fileName is required in query params'),
    /** When set, enforces this model's `roles` for `update` access (same as mutating that resource). */
    modelKey: z.string().optional(),
  }).parse)

  if (query.modelKey) {
    const cfg = getModelConfig(query.modelKey)
    assertRoleAccessAllowed(event, { roles: cfg.roles }, 'update')
  }

  let url: string
  try {
    url = await uploadToObjectStorage(stream, {
      extension: query.fileName.split('.').pop() || 'bin',
      filename: query.fileName,
      fileType: query.fileType,
      prefix: query.prefix,
      contentLength,
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
