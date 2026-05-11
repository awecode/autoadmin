import { getUserRoleFromEvent } from '#autoadmin/roleAccess'
import { z } from 'zod'
import uploadToObjectStorage from '../../utils/objectStorage'
import { normalizeRuntimeRoleAllowlist } from '../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const stream = getRequestWebStream(event)

  if (!stream) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file body provided in the request',
    })
  }

  const rc = useRuntimeConfig()
  const fileUploadRoles = normalizeRuntimeRoleAllowlist(rc.autoadmin?.fileUploadRoles)
  if (fileUploadRoles?.length) {
    const userRole = getUserRoleFromEvent(event)
    if (!userRole || !fileUploadRoles.includes(userRole)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
      })
    }
  }

  const contentLength = getRequestHeader(event, 'content-length')

  const query = await getValidatedQuery(event, z.object({
    prefix: z.string().optional(),
    fileType: z.string().optional(),
    fileName: z.string().min(1, 'fileName is required in query params'),
  }).parse)

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
