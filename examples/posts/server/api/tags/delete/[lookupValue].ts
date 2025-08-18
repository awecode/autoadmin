import type { AdminModelOptions } from '#layers/autoadmin/server/utils/registry'
import { deleteRecord } from '#layers/autoadmin/server/services/delete'
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { tags } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const options: AdminModelOptions<typeof tags> = {
    create: {
      enabled: true,
    },
  }
  const lookupValue = getRouterParam(event, 'lookupValue')
  if (!lookupValue) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Lookup value is required',
    })
  }
  const cfg = useAdminRegistry().configure(tags, options)
  return await deleteRecord(cfg, lookupValue)
})
