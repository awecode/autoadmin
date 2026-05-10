import { z } from 'zod'
import { bulkDeleteJsonArrayRecords } from '../../../services/jsonResourceCrud'
import { useJsonResourceRegistry } from '../../../utils/jsonResourceRegistry'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelKey: z.string(),
    rowLookups: z.array(z.union([z.string(), z.number()])),
  }).parse)

  const reg = useJsonResourceRegistry()
  const cfg = reg.get(body.modelKey)
  if (!cfg || cfg.kind !== 'array') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Array JSON resource not found.',
    })
  }
  return await bulkDeleteJsonArrayRecords(cfg, body.rowLookups)
})
