import type { AdminModelOptions } from '#layers/autoadmin/composables/registry'
import { useAdminRegistry } from '#layers/autoadmin/composables/registry'
import { listRecords } from '#layers/autoadmin/server/services/list'
import { tags } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const options: AdminModelOptions<typeof tags> = {
    list: {
      title: 'All Tags',
      searchPlaceholder: 'Search all tags',
      searchFields: ['name'],
    },
  }
  const cfg = useAdminRegistry().configure(tags, options)
  return await listRecords(cfg, event)
})
