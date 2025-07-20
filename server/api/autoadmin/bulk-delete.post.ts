import { bulkDelete } from '#layers/autoadmin/server/services/delete'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelLabel: z.string(),
    rowLookups: z.array(z.union([z.string(), z.number()])),
  }).parse)

  return await bulkDelete(body.modelLabel, body.rowLookups)
})
