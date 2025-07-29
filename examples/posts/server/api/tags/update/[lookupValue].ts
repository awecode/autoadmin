import type { AdminModelOptions } from '#layers/autoadmin/composables/registry'
import { useAdminRegistry } from '#layers/autoadmin/composables/registry'
import { updateRecord } from '#layers/autoadmin/server/services/update'
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
  return await updateRecord(cfg, lookupValue, event)
})