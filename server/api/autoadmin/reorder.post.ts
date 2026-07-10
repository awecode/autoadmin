import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getModelConfig } from '../../utils/autoadmin'
import { assertLookupsInBaseWhere, buildBaseWhereContext, getBaseWhereClause, mergeWhere } from '../../utils/baseWhere'
import { useAdminDb } from '../../utils/db'
import { handleDrizzleError } from '../../utils/drizzle'
import { batchUpdate, fetchSortedRows, resequenceAndUpdate } from '../../utils/reorder'
import { assertRoleAccessAllowed } from '../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelKey: z.string(),
    orderedLookups: z.array(z.union([z.string(), z.number()])).min(1),
  }).parse)

  const cfg = getModelConfig(body.modelKey)
  assertRoleAccessAllowed(event, { roles: cfg.roles }, 'update')

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

  const db = await useAdminDb()
  const requestCtx = { event }
  const reorderCtx = buildBaseWhereContext(cfg, 'reorder', requestCtx, { lookupValues: body.orderedLookups })

  try {
    await assertLookupsInBaseWhere(db, cfg, reorderCtx, body.orderedLookups)

    const pageWhere = await mergeWhere(
      inArray(cfg.lookupColumn, body.orderedLookups),
      await getBaseWhereClause(cfg, reorderCtx),
    )
    let pageQuery = (db as any)
      .select({ lookup: cfg.lookupColumn, sortValue: sortColumn })
      .from(cfg.model)
    if (pageWhere) {
      pageQuery = pageQuery.where(pageWhere)
    }
    const pageRows = await pageQuery

    const requestedLookups = body.orderedLookups.map(lookup => String(lookup))
    const requestedLookupSet = new Set(requestedLookups)
    if (requestedLookupSet.size !== requestedLookups.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid reorder payload: duplicate lookup values are not allowed.',
      })
    }

    const foundLookupSet = new Set(pageRows.map((row: any) => String(row.lookup)))
    if (foundLookupSet.size !== requestedLookupSet.size || !requestedLookups.every(lookup => foundLookupSet.has(lookup))) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid reorder payload: one or more lookup values do not exist.',
      })
    }

    const pageValues = pageRows.map((r: any) => r.sortValue as number)
    const hasUniqueValues = new Set(pageValues).size === pageValues.length

    if (hasUniqueValues) {
      // Fast path: redistribute existing unique values in the new order
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
        await batchUpdate(db as any, cfg.model, cfg.sortField, cfg.lookupColumn, updates)
      }
    }
    else {
      // Slow path: full-table resequence (first use / duplicate values)
      const { allLookups, oldValues } = await fetchSortedRows(db, cfg, requestCtx)

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

      await resequenceAndUpdate(db as any, cfg, allLookups, oldValues)
    }
  }
  catch (error) {
    if ((error as any)?.statusCode) {
      throw error
    }
    throw createError(handleDrizzleError(error))
  }

  return { success: true, message: 'Order updated successfully' }
})
