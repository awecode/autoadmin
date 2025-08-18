import type { AdminModelConfig } from '#layers/autoadmin/server/utils/registry'
import type { Table } from 'drizzle-orm'
import { eq, inArray } from 'drizzle-orm'
import { useAdminDb } from '../utils/db'
import { handleDrizzleError } from '../utils/drizzle'

export async function deleteRecord<T extends Table>(cfg: AdminModelConfig<T>, lookupValue: string): Promise<any> {
  const modelKey = cfg.key
  if (!cfg.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model "${modelKey}" does not allow deletion.`,
    })
  }
  const model = cfg.model
  const db = useAdminDb()
  const lookupColumn = cfg.lookupColumn
  try {
    await db.delete(model).where(eq(lookupColumn, lookupValue))
  } catch (error) {
    throw handleDrizzleError(error)
  }

  return {
    success: true,
    message: `${modelKey} ${lookupValue} deleted successfully`,
  }
}

export async function bulkDelete(modelKey: string, rowLookups: (string | number)[]) {
  const cfg = getModelConfig(modelKey)
  if (!cfg.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model "${modelKey}" does not allow deletion.`,
    })
  }
  const model = cfg.model
  const db = useAdminDb()
  const lookupColumn = cfg.lookupColumn
  try {
    await db.delete(model).where(inArray(lookupColumn, rowLookups))
  } catch (error) {
    throw handleDrizzleError(error)
  }

  return {
    success: true,
    message: `${modelKey} ${rowLookups.length} rows deleted successfully`,
  }
}
