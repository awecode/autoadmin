import type { AdminModelConfig } from '#layers/autoadmin/composables/useAdminRegistry'
import type { M2MRelation } from '#layers/autoadmin/utils/relation'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { parseM2mRelations, parseO2mRelation } from '#layers/autoadmin/utils/relation'
import { unwrapZodType } from '#layers/autoadmin/utils/zod'
import { and, eq, getTableColumns, getTableName, inArray, not } from 'drizzle-orm'
import { DrizzleQueryError } from 'drizzle-orm/errors'

const NOTNULL_CONSTRAINT_CODES = ['SQLITE_CONSTRAINT_NOTNULL']

export function getModelConfig(modelLabel: string): AdminModelConfig {
  const registry = useAdminRegistry()
  const cfg = registry.get(modelLabel)
  if (!cfg) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} not registered.`,
    })
  }
  return cfg
}

async function saveO2mRelation(db: DrizzleD1Database, cfg: AdminModelConfig, preprocessed: any, result: { [x: string]: any }[]) {
  if (cfg.o2m) {
    const modelLabel = cfg.label
    for (const [name, table] of Object.entries(cfg.o2m)) {
      const relationData = parseO2mRelation(cfg, table, name)
      const fieldName = relationData.fieldName
      const newValues = preprocessed[fieldName]
      if (newValues) {
        const selfValue = result[0][relationData.selfPrimaryColumn.name]
        // Step 1: Unset foreignRelatedColumn for all rows pointing to selfValue, except those in newValues
        try {
          await db.update(table).set({ [relationData.foreignRelatedColumn.name]: null }).where(and(eq(relationData.foreignRelatedColumn, selfValue), not(inArray(relationData.foreignPrimaryColumn, newValues))))
        } catch (error) {
          if (error instanceof DrizzleQueryError) {
            if (error.cause && 'code' in error.cause && typeof error.cause.code === 'string' && NOTNULL_CONSTRAINT_CODES.includes(error.cause.code)) {
              const userFriendlyMessage = `Cannot remove the relation to ${modelLabel} (${selfValue}) from existing records in ${getTableName(table)} because this field is required and cannot be null.`
              throw createError({
                statusCode: 400,
                // statusMessage: `Cannot unset this ${foreignRelatedColumn.name} (${selfValue}) in previously existing records in ${getTableName(table)} because it can not be empty/null.`,
                statusMessage: `Cannot remove the relation to ${modelLabel} (${selfValue}) from existing records in ${getTableName(table)} because this field is required and cannot be null.`,
                data: {
                  message: userFriendlyMessage,
                  errors: [{
                    name: relationData.fieldName,
                    message: userFriendlyMessage,
                  }],
                },
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
        [relation.selfColumn.name]: selfValue,
        [relation.otherColumn.name]: value,
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

  const existingOtherIds = existing.map(row => row[relation.otherColumn.name])

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
        [relation.otherColumn.name]: otherForeignColumnValue,
        [relation.selfColumn.name]: selfValue,
      })),
    )
  }
}
export async function createRecord(modelLabel: string, data: any): Promise<any> {
  const cfg = getModelConfig(modelLabel)
  if (!cfg.create.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow creation.`,
    })
  }
  const model = cfg.model
  const db = useDb()

  const schema = cfg.create.schema

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

  let result
  try {
    result = await db.insert(model).values(validatedData).returning()
  } catch (error) {
    throw handleDrizzleError(error)
  }

  if (cfg.m2m) {
    const relations = parseM2mRelations(model, cfg.m2m)
    for (const relation of relations) {
      const fieldName = `___${relation.name}___${relation.otherColumn.name}`
      if (preprocessed[fieldName]) {
        const selfValue = result[0][relation.selfForeignColumn.name]
        await saveM2mRelation(db, relation, selfValue, preprocessed[fieldName])
      }
    }
  }

  await saveO2mRelation(db, cfg, preprocessed, result)

  return {
    success: true,
    message: `${modelLabel} created successfully`,
    data: result[0],
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
  const cfg = getModelConfig(modelLabel)
  if (!cfg.update.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow updates.`,
    })
  }
  const model = cfg.model
  const db = useDb()

  const schema = cfg.update.schema

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

  let result
  try {
    result = await db.update(model).set(validatedData).where(eq(cfg.lookupColumn, lookupValue)).returning()
  } catch (error) {
    throw handleDrizzleError(error)
  }

  if (cfg.m2m) {
    const relations = parseM2mRelations(model, cfg.m2m)
    for (const relation of relations) {
      const fieldName = `___${relation.name}___${relation.otherColumn.name}`
      if (preprocessed[fieldName]) {
        const selfValue = result[0][relation.selfForeignColumn.name]
        await saveM2mRelation(db, relation, selfValue, preprocessed[fieldName])
      }
    }
  }

  await saveO2mRelation(db, cfg, preprocessed, result)

  return {
    success: true,
    message: `${modelLabel} updated successfully`,
    data: result[0],
  }
}
