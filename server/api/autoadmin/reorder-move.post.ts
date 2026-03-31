import { z } from 'zod'
import { getModelConfig } from '../../utils/autoadmin'
import { useAdminDb } from '../../utils/db'
import { handleDrizzleError } from '../../utils/drizzle'
import { fetchSortedRows, resequenceAndUpdate } from '../../utils/reorder'

const moveActions = ['first', 'page-up', 'page-down', 'last'] as const

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    modelKey: z.string(),
    lookup: z.union([z.string(), z.number()]),
    action: z.enum(moveActions),
    pageSize: z.number().int().positive(),
  }).parse)

  const cfg = getModelConfig(body.modelKey)

  if (!cfg.sortField) {
    throw createError({
      statusCode: 400,
      statusMessage: `Model "${body.modelKey}" does not have a sortField configured.`,
    })
  }

  if (!cfg.columns[cfg.sortField]) {
    throw createError({
      statusCode: 400,
      statusMessage: `Sort field "${cfg.sortField}" not found on model "${body.modelKey}".`,
    })
  }

  const db = useAdminDb()

  try {
    const { allLookups, oldValues } = await fetchSortedRows(db, cfg)

    const currentIndex = allLookups.findIndex(l => String(l) === String(body.lookup))
    if (currentIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Item not found.',
      })
    }

    let targetIndex: number
    switch (body.action) {
      case 'first':
        targetIndex = 0
        break
      case 'page-up':
        targetIndex = Math.max(0, currentIndex - body.pageSize)
        break
      case 'page-down':
        targetIndex = Math.min(allLookups.length - 1, currentIndex + body.pageSize)
        break
      case 'last':
        targetIndex = allLookups.length - 1
        break
    }

    if (targetIndex === currentIndex) {
      return { success: true, message: 'No change needed.' }
    }

    // Remove from current position and insert at target
    const [item] = allLookups.splice(currentIndex, 1)
    allLookups.splice(targetIndex, 0, item!)

    await resequenceAndUpdate(db as any, cfg, allLookups, oldValues)
  }
  catch (error: any) {
    if (error.statusCode)
      throw error
    throw createError(handleDrizzleError(error))
  }

  return { success: true, message: 'Item moved successfully.' }
})
