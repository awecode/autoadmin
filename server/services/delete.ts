import { eq, inArray } from 'drizzle-orm'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import { getModelConfig } from './autoadmin'

export async function deleteRecord(modelLabel: string, lookupValue: string): Promise<any> {
  const modelConfig = getModelConfig(modelLabel)
  if (!modelConfig.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow deletion.`,
    })
  }
  const model = modelConfig.model
  const db = useDb()
  const lookupColumn = modelConfig.lookupColumn
  try {
    await db.delete(model).where(eq(lookupColumn, lookupValue))
  } catch (error) {
    if (error instanceof DrizzleQueryError) {
      if (error.cause && 'code' in error.cause && error.cause.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot delete record because it is referenced by another record',
        })
      }
    }
    throw handleDrizzleError(error)
  }

  return {
    success: true,
    message: `${modelLabel} ${lookupValue} deleted successfully`,
  }
}

export async function bulkDelete(modelLabel: string, rowLookups: string[]): Promise<any> {
  const modelConfig = getModelConfig(modelLabel)
  if (!modelConfig.delete.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow deletion.`,
    })
  }
  const model = modelConfig.model
  const db = useDb()
  const lookupColumn = modelConfig.lookupColumn
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
