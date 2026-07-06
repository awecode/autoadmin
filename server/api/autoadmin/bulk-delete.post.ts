import { z } from 'zod'
import { bulkDelete } from '../../services/delete'
import { getModelConfig } from '../../utils/autoadmin'
import { assertRoleAccessAllowed } from '../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelKey: z.string(),
    rowLookups: z.array(z.union([z.string(), z.number()])),
  }).parse)

  const cfg = getModelConfig(body.modelKey)
  assertRoleAccessAllowed(event, { roles: cfg.roles }, 'delete')
  return await bulkDelete(body.modelKey, body.rowLookups, { event })
})
