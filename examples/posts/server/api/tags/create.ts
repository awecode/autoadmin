import type { AdminModelOptions } from '#layers/autoadmin/server/utils/registry'
import { createRecord } from '#layers/autoadmin/server/services/create'
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { tags } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const options: AdminModelOptions<typeof tags> = {
    create: {
      enabled: true,
    },
  }
  const cfg = useAdminRegistry().configure(tags, options)
  return await createRecord(cfg, event)
})
