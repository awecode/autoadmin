import type { AdminModelConfig } from '#layers/autoadmin/composables/registry'
import type { Table } from 'drizzle-orm'
import { eq, inArray } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { handleDrizzleError } from '../utils/drizzle'

export async function deleteRecord<T extends Table>(cfg: AdminModelConfig<T>, lookupValue: string): Promise<any> {
  const modelLabel = cfg.label
  if (!cfg.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow deletion.`,
    })
  }
  const model = cfg.model
  const db = useDb()
  const lookupColumn = cfg.lookupColumn
  try {
    await db.delete(model).where(eq(lookupColumn, lookupValue))
  } catch (error) {
    throw handleDrizzleError(error)
  }

  return {
    success: true,
    message: `${modelLabel} ${lookupValue} deleted successfully`,
  }
}

export async function bulkDelete(modelLabel: string, rowLookups: (string | number)[]) {
  const cfg = getModelConfig(modelLabel)
  if (!cfg.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow deletion.`,
    })
  }
  const model = cfg.model
  const db = useDb()
  const lookupColumn = cfg.lookupColumn
  try {
    await db.delete(model).where(inArray(lookupColumn, rowLookups))
  } catch (error) {
    throw handleDrizzleError(error)
  }

  return {
    success: true,
    message: `${modelLabel} ${rowLookups.length} rows deleted successfully`,
  }
}
