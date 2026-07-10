import type { AdminModelConfig, AutoadminRequestContext } from '#layers/autoadmin/server/utils/registry'
import type { InferSelectModel, Table } from 'drizzle-orm'
import { eq, inArray } from 'drizzle-orm'
import { getModelConfig } from '../utils/autoadmin'
import { buildBaseWhereContext, whereWithBaseWhere } from '../utils/baseWhere'
import { useAdminDb } from '../utils/db'
import { handleDrizzleError } from '../utils/drizzle'

export async function deleteRecord<T extends Table>(
  cfg: AdminModelConfig<T>,
  lookupValue: string,
  requestCtx?: AutoadminRequestContext,
): Promise<any> {
  const modelKey = cfg.key
  if (!cfg.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model "${modelKey}" does not allow deletion.`,
    })
  }
  const model = cfg.model
  const db = await useAdminDb()
  const lookupColumn = cfg.lookupColumn
  await cfg.delete.before?.(db, {
    config: cfg,
    lookupValue,
  })

  const baseWhereCtx = buildBaseWhereContext(cfg, 'delete', requestCtx, { lookupValue })
  const deleteWhere = await whereWithBaseWhere(cfg, baseWhereCtx, eq(lookupColumn, lookupValue))

  let deletedRecord
  try {
    let deleteQuery = db.delete(model)
    if (deleteWhere) {
      deleteQuery = deleteQuery.where(deleteWhere) as typeof deleteQuery
    }
    const deleted = await deleteQuery.returning()
    if (!deleted.length) {
      throw createError({
        statusCode: 404,
        statusMessage: `No instance found for model "${modelKey}" with lookup value "${lookupValue}".`,
      })
    }
    deletedRecord = deleted[0]
  }
  catch (error) {
    throw createError(handleDrizzleError(error))
  }

  await cfg.delete.after?.(db, {
    config: cfg,
    lookupValue,
    record: deletedRecord! as unknown as InferSelectModel<T>,
  })

  return {
    success: true,
    message: `${modelKey} ${lookupValue} deleted successfully`,
  }
}

export async function bulkDelete(
  modelKey: string,
  rowLookups: (string | number)[],
  requestCtx?: AutoadminRequestContext,
) {
  const cfg = getModelConfig(modelKey)
  if (!cfg.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model "${modelKey}" does not allow deletion.`,
    })
  }
  const model = cfg.model
  const db = await useAdminDb()
  const lookupColumn = cfg.lookupColumn
  const baseWhereCtx = buildBaseWhereContext(cfg, 'bulkDelete', requestCtx, { lookupValues: rowLookups })
  const deleteWhere = await whereWithBaseWhere(cfg, baseWhereCtx, inArray(lookupColumn, rowLookups))
  try {
    let deleteQuery = db.delete(model)
    if (deleteWhere) {
      deleteQuery = deleteQuery.where(deleteWhere) as typeof deleteQuery
    }
    const deleted = await deleteQuery.returning()
    if (deleted.length !== rowLookups.length) {
      throw createError({
        statusCode: 404,
        statusMessage: `One or more records are not available for model "${modelKey}".`,
      })
    }
  }
  catch (error) {
    throw createError(handleDrizzleError(error))
  }

  return {
    success: true,
    message: `${modelKey} ${rowLookups.length} rows deleted successfully`,
  }
}
