import { asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getModelConfig } from '../../utils/autoadmin'
import { useAdminDb } from '../../utils/db'
import { handleDrizzleError } from '../../utils/drizzle'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelKey: z.string(),
    orderedLookups: z.array(z.union([z.string(), z.number()])).min(1),
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
    // Fetch current sortField values for the given rows
    const rows = await (db as any)
      .select({
        lookup: cfg.lookupColumn,
        sortValue: sortColumn,
      })
      .from(model)
      .where(inArray(cfg.lookupColumn, body.orderedLookups))
      .orderBy(asc(sortColumn))

    // Collect existing sort values (ascending) and redistribute them in
    // the new order the client specified. This preserves relative
    // positioning with rows on other pages.
    const sortedValues = rows
      .map((r: any) => r.sortValue as number)
      .sort((a: number, b: number) => a - b)

    // Ensure values are strictly increasing so every row gets a distinct
    // position. Handles the all-zeros / duplicate-values case.
    for (let i = 1; i < sortedValues.length; i++) {
      if (sortedValues[i]! <= sortedValues[i - 1]!) {
        sortedValues[i] = sortedValues[i - 1]! + 1
      }
    }

    for (let i = 0; i < body.orderedLookups.length; i++) {
      const lookup = body.orderedLookups[i]
      const newSortValue = sortedValues[i]
      if (newSortValue === undefined)
        continue
      await (db as any).update(model).set({ [cfg.sortField]: newSortValue }).where(eq(cfg.lookupColumn, lookup))
    }
  }
  catch (error) {
    throw createError(handleDrizzleError(error))
  }

  return { success: true, message: 'Order updated successfully' }
})
