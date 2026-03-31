import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getModelConfig } from '../../utils/autoadmin'
import { useAdminDb } from '../../utils/db'
import { handleDrizzleError } from '../../utils/drizzle'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelKey: z.string(),
    items: z.array(z.object({
      lookup: z.union([z.string(), z.number()]),
      sortOrder: z.number().int(),
    })).min(1),
  }).parse)

  const cfg = getModelConfig(body.modelKey)

  if (!cfg.sortField) {
    throw createError({
      statusCode: 400,
      statusMessage: `Model "${body.modelKey}" does not have a sortField configured.`,
    })
  }

  const sortColumn = cfg.columns[cfg.sortField]
  if (!sortColumn) {
    throw createError({
      statusCode: 400,
      statusMessage: `Sort field "${cfg.sortField}" not found on model "${body.modelKey}".`,
    })
  }

  const db = useAdminDb()
  const model = cfg.model

  try {
    for (const item of body.items) {
      await (db as any).update(model)
        .set({ [cfg.sortField]: item.sortOrder })
        .where(eq(cfg.lookupColumn, item.lookup))
    }
  }
  catch (error) {
    throw createError(handleDrizzleError(error))
  }

  return { success: true, message: 'Order updated successfully' }
})
