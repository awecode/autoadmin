import type { M2MRelation } from '#layers/autoadmin/utils/relation'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { unwrapZodType } from '#layers/autoadmin/utils/form'
import { parseM2mRelations, parseO2mRelation } from '#layers/autoadmin/utils/relation'
import { and, count, eq, getTableColumns, getTableName, inArray, not } from 'drizzle-orm'
import { DrizzleQueryError } from 'drizzle-orm/errors'

async function saveO2mRelation(db: DrizzleD1Database, modelConfig: AdminModelConfig, preprocessed: any, result: { [x: string]: any }[]) {
  if (modelConfig.o2m) {
    const modelLabel = modelConfig.label
    for (const [name, table] of Object.entries(modelConfig.o2m)) {
      const relationData = parseO2mRelation(modelConfig, table, name)
      const fieldName = relationData.fieldName
      const newValues = preprocessed[fieldName]
      if (newValues) {
        const selfValue = result[0][relationData.selfPrimaryColumn.name]
        // Step 1: Unset foreignRelatedColumn for all rows pointing to selfValue, except those in newValues
        try {
          await db.update(table).set({ [relationData.foreignRelatedColumn.name]: null }).where(and(eq(relationData.foreignRelatedColumn, selfValue), not(inArray(relationData.foreignPrimaryColumn, newValues))))
        } catch (error) {
          if (error instanceof DrizzleQueryError) {
            if (error.cause && 'code' in error.cause && error.cause.code === 'SQLITE_CONSTRAINT_NOTNULL') {
              throw createError({
                statusCode: 400,
                // statusMessage: `Cannot unset this ${foreignRelatedColumn.name} (${selfValue}) in previously existing records in ${getTableName(table)} because it can not be empty/null.`,
                statusMessage: `Cannot remove the relation to ${modelLabel} (${selfValue}) from existing records in ${getTableName(table)} because this field is required and cannot be null.`,
              })
            }
          }
          throw handleDrizzleError(error)
        }
        // Step 2 : Set `relatedColumnName` in `table` for the new values for selfValue
        if (newValues.length > 0) {
          await db.update(table).set({ [relationData.foreignRelatedColumn.name]: selfValue }).where(inArray(relationData.foreignPrimaryColumn, newValues))
        }
      }
    }
  }
}

async function saveM2mRelation(db: DrizzleD1Database, relation: M2MRelation, selfValue: any, newValues: any[]) {
  // if the m2m table has only two columns, we can delete and insert all at once
  if (Object.keys(getTableColumns(relation.m2mTable)).length === 2) {
    await db.delete(relation.m2mTable).where(eq(relation.selfColumn, selfValue))
    if (newValues.length > 0) {
      await db.insert(relation.m2mTable).values(newValues.map(value => ({
        [relation.selfColumnName]: selfValue,
        [relation.otherColumnName]: value,
      })))
    }
    return
  }
  // if the m2m table has more than two columns, there may be additional columns in junction table, so we can't just delete and insert all at once
  // we need to preserve the exisiting relationships which are also in the new values

  // Get existing relationships
  const existing = await db.select()
    .from(relation.m2mTable)
    .where(eq(relation.selfColumn, selfValue))

  const existingOtherIds = existing.map(row => row[relation.otherColumnName])

  // Find records to delete (exist but not in new set)
  const toDelete = existingOtherIds.filter(id => !newValues.includes(id))

  // Find records to insert (in new set but don't exist)
  const toInsert = newValues.filter((id: any) => !existingOtherIds.includes(id))

  // Delete records that are no longer needed
  if (toDelete.length > 0) {
    await db.delete(relation.m2mTable)
      .where(and(
        eq(relation.selfColumn, selfValue),
        inArray(relation.otherColumn, toDelete),
      ))
  }

  // Insert new records
  if (toInsert.length > 0) {
    await db.insert(relation.m2mTable).values(
      toInsert.map((otherForeignColumnValue: any) => ({
        [relation.otherColumnName]: otherForeignColumnValue,
        [relation.selfColumnName]: selfValue,
      })),
    )
  }
}

function getModelConfig(modelLabel: string): AdminModelConfig {
  const registry = useAdminRegistry()
  const modelConfig = registry.get(modelLabel)
  if (!modelConfig) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} not registered.`,
    })
  }
  return modelConfig
}

function getModel(modelLabel: string) {
  return getModelConfig(modelLabel).model
}

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
  const model = getModel(modelLabel)
  const db = useDb()

  const baseQuery = db.select().from(model)
  const countQuery = db.select({ resultCount: count() }).from(model)

  try {
    return getPaginatedResponse<typeof model>(baseQuery, countQuery, query)
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch ${modelLabel}`,
      data: error,
    })
  }
}

export async function createRecord(modelLabel: string, data: any): Promise<any> {
  const modelConfig = getModelConfig(modelLabel)
  const model = modelConfig.model
  const db = useDb()

  const schema = modelConfig.create.schema

  const shape = schema.shape

  // Preprocess string values into Date for date fields
  const preprocessed = { ...data }
  for (const key in shape) {
    const fieldSchema = unwrapZodType(shape[key])
    if (fieldSchema.innerType.def.type === 'date' && typeof preprocessed[key] === 'string') {
      const maybeDate = new Date(preprocessed[key])
      if (!Number.isNaN(maybeDate.getTime())) {
        preprocessed[key] = maybeDate
      }
    }
  }

  const validatedData = schema.parse(preprocessed)

  const result = await db.insert(model).values(validatedData).returning()

  if (modelConfig.m2m) {
    const relations = parseM2mRelations(model, modelConfig.m2m)
    for (const relation of relations) {
      const fieldName = `___${relation.name}___${relation.otherColumnName}`
      if (preprocessed[fieldName]) {
        const selfValue = result[0][relation.selfForeignColumnName]
        await saveM2mRelation(db, relation, selfValue, preprocessed[fieldName])
      }
    }
  }

  await saveO2mRelation(db, modelConfig, preprocessed, result)

  return {
    success: true,
    message: `${modelLabel} created successfully`,
    data: result,
  }
}

// TODO: Implement actual database calls
export async function getRecordDetail(modelLabel: string, lookupValue: string): Promise<any> {
  return {
    id: lookupValue,
    name: `Sample ${modelLabel}`,
    created_at: new Date().toISOString(),
  }
}

export async function updateRecord(modelLabel: string, lookupValue: string, data: any): Promise<any> {
  const modelConfig = getModelConfig(modelLabel)
  const model = modelConfig.model
  const db = useDb()

  const schema = modelConfig.update.schema

  const shape = schema.shape

  // Preprocess string values into Date for date fields
  const preprocessed = { ...data }
  for (const key in shape) {
    const fieldSchema = unwrapZodType(shape[key])
    if (fieldSchema.innerType.def.type === 'date' && typeof preprocessed[key] === 'string') {
      const maybeDate = new Date(preprocessed[key])
      if (!Number.isNaN(maybeDate.getTime())) {
        preprocessed[key] = maybeDate
      }
    }
  }

  const validatedData = schema.parse(preprocessed)

  const result = await db.update(model).set(validatedData).where(eq(modelConfig.lookupColumn, lookupValue)).returning()

  if (modelConfig.m2m) {
    const relations = parseM2mRelations(model, modelConfig.m2m)
    for (const relation of relations) {
      const fieldName = `___${relation.name}___${relation.otherColumnName}`
      if (preprocessed[fieldName]) {
        const selfValue = result[0][relation.selfForeignColumnName]
        await saveM2mRelation(db, relation, selfValue, preprocessed[fieldName])
      }
    }
  }

  await saveO2mRelation(db, modelConfig, preprocessed, result)

  return {
    success: true,
    message: `${modelLabel} updated successfully`,
    data: result,
  }
}

export async function deleteRecord(modelLabel: string, lookupValue: string): Promise<any> {
  const modelConfig = getModelConfig(modelLabel)
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
