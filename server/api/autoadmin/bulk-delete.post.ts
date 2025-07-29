import { z } from 'zod'
import { bulkDelete } from '../../services/delete'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelKey: z.string(),
    rowLookups: z.array(z.union([z.string(), z.number()])),
  }).parse)

  return await bulkDelete(body.modelKey, body.rowLookups)
})
