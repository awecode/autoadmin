import { asc, inArray, sql } from 'drizzle-orm'
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
    // Fetch current sort values for the page's items
    const pageRows = await (db as any)
      .select({ lookup: cfg.lookupColumn, sortValue: sortColumn })
      .from(model)
      .where(inArray(cfg.lookupColumn, body.orderedLookups))

    const pageValues = pageRows.map((r: any) => r.sortValue as number)
    const uniqueValues = new Set(pageValues)
    const hasUniqueValues = uniqueValues.size === pageValues.length

    if (hasUniqueValues) {
      // Fast path: values are already unique — redistribute them among
      // the reordered items. Only touches the page's rows (1 SELECT + 1 UPDATE).
      const sorted = [...pageValues].sort((a, b) => a - b)
      const updates = new Map<string | number, number>()
      const oldByLookup = new Map(pageRows.map((r: any) => [String(r.lookup), r.sortValue as number]))

      for (let i = 0; i < body.orderedLookups.length; i++) {
        const lookup = body.orderedLookups[i]!
        if (oldByLookup.get(String(lookup)) !== sorted[i]) {
          updates.set(lookup, sorted[i]!)
        }
      }

      if (updates.size > 0) {
        await batchUpdate(db, model, cfg.sortField, cfg.lookupColumn, updates)
      }
    }
    else {
      // Slow path: values have duplicates — must resequence the full table
      // to establish unique ordering. Happens once on first use.
      const allRows = await (db as any)
        .select({ lookup: cfg.lookupColumn, sortValue: sortColumn })
        .from(model)
        .orderBy(asc(sortColumn), asc(cfg.lookupColumn))

      const allLookups: (string | number)[] = allRows.map((r: any) => r.lookup)

      // Find positions occupied by the page's items and substitute the new order
      const reorderedSet = new Set(body.orderedLookups.map(String))
      const pagePositions: number[] = []
      for (let i = 0; i < allLookups.length; i++) {
        if (reorderedSet.has(String(allLookups[i]))) {
          pagePositions.push(i)
        }
      }
      for (let i = 0; i < body.orderedLookups.length; i++) {
        if (pagePositions[i] !== undefined) {
          allLookups[pagePositions[i]!] = body.orderedLookups[i]!
        }
      }

      // Collect only the rows whose sort value actually changed
      const oldValues = new Map(allRows.map((r: any) => [String(r.lookup), r.sortValue as number]))
      const updates = new Map<string | number, number>()
      for (let i = 0; i < allLookups.length; i++) {
        const lookup = allLookups[i]!
        if (oldValues.get(String(lookup)) !== i) {
          updates.set(lookup, i)
        }
      }

      if (updates.size > 0) {
        await batchUpdate(db, model, cfg.sortField, cfg.lookupColumn, updates)
      }
    }
  }
  catch (error) {
    throw createError(handleDrizzleError(error))
  }

  return { success: true, message: 'Order updated successfully' }
})

/**
 * Batch-update sort values using a single UPDATE ... SET = CASE statement.
 * Turns N individual UPDATEs into 1 query.
 */
async function batchUpdate(
  db: any,
  model: any,
  sortField: string,
  lookupColumn: any,
  updates: Map<string | number, number>,
) {
  const lookups = [...updates.keys()]
  const caseClauses = lookups.map(lookup => sql`WHEN ${lookupColumn} = ${lookup} THEN CAST(${updates.get(lookup)!} AS INTEGER)`)
  const caseExpr = sql.join([sql`CASE`, ...caseClauses, sql`END`], sql` `)

  await db.update(model).set({ [sortField]: caseExpr }).where(inArray(lookupColumn, lookups))
}
