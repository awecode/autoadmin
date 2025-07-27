import { z } from 'zod'
import { getModelConfig } from '../../utils/autoadmin'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    action: z.string(),
    modelLabel: z.string(),
    rowLookups: z.union([z.array(z.string()), z.array(z.number())]),
  }).parse)
  const cfg = getModelConfig(body.modelLabel)
  const action = cfg.list.bulkActions.find(action => action.label === body.action)
  if (!action) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Action not found',
    })
  }
  const db = useDb()
  const result = await action.action(db, body.rowLookups)
  return result
})
