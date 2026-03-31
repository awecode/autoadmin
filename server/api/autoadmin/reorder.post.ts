import { asc, eq } from 'drizzle-orm'
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
    // Fetch ALL rows in current sort order (deterministic with lookup as tiebreaker)
    const allRows = await (db as any)
      .select({ lookup: cfg.lookupColumn, sortValue: sortColumn })
      .from(model)
      .orderBy(asc(sortColumn), asc(cfg.lookupColumn))

    // Build the full ordered list of lookups
    const allLookups: (string | number)[] = allRows.map((r: any) => r.lookup)

    // Find the positions in the global list occupied by the page's items
    const reorderedSet = new Set(body.orderedLookups.map(String))
    const pagePositions: number[] = []
    for (let i = 0; i < allLookups.length; i++) {
      if (reorderedSet.has(String(allLookups[i]))) {
        pagePositions.push(i)
      }
    }

    // Place the client's reordered lookups into those positions
    for (let i = 0; i < body.orderedLookups.length; i++) {
      if (pagePositions[i] !== undefined) {
        allLookups[pagePositions[i]!] = body.orderedLookups[i]!
      }
    }

    // Assign sequential values and only update rows whose value changed
    const oldValues = new Map(allRows.map((r: any) => [String(r.lookup), r.sortValue as number]))
    for (let i = 0; i < allLookups.length; i++) {
      const lookup = allLookups[i]
      if (oldValues.get(String(lookup)) !== i) {
        await (db as any).update(model).set({ [cfg.sortField]: i }).where(eq(cfg.lookupColumn, lookup))
      }
    }
  }
  catch (error) {
    throw createError(handleDrizzleError(error))
  }

  return { success: true, message: 'Order updated successfully' }
})
