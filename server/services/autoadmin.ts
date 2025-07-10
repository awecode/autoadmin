import type { AdminModelConfig, ListColumnDef, ListFieldDef } from '#layers/autoadmin/composables/useAdminRegistry'
import type { ListFieldType } from '#layers/autoadmin/utils/list.js'
import type { TableMetadata } from '#layers/autoadmin/utils/metdata'
import type { M2MRelation } from '#layers/autoadmin/utils/relation'
import type { Column, Table } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { zodToListSpec } from '#layers/autoadmin/utils/list.js'
import { getTableMetadata } from '#layers/autoadmin/utils/metdata'
import { getTableForeignKeys, parseM2mRelations, parseO2mRelation } from '#layers/autoadmin/utils/relation'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { unwrapZodType } from '#layers/autoadmin/utils/zod'
import { and, count, eq, getTableColumns, getTableName, inArray, not } from 'drizzle-orm'
import { DrizzleQueryError } from 'drizzle-orm/errors'

const NOTNULL_CONSTRAINT_CODES = ['SQLITE_CONSTRAINT_NOTNULL']

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
            if (error.cause && 'code' in error.cause && typeof error.cause.code === 'string' && NOTNULL_CONSTRAINT_CODES.includes(error.cause.code)) {
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

function getListColumns<T extends Table>(cfg: AdminModelConfig<T>, tableColumns: Record<string, Column>, columnTypes: Record<string, ListFieldType>, metadata: TableMetadata): ListColumnDef<T>[] {
  let columns: ListColumnDef<T>[] = []
  if (cfg.list?.columns) {
    columns = cfg.list.columns
  } else if (cfg.list?.fields) {
    columns = cfg.list.fields.map((def: ListFieldDef<T>) => {
      if (typeof def === 'string') {
        return {
          id: def,
          accessorKey: def,
          header: toTitleCase(def),
          type: columnTypes[def],
        }
      }
      return {
        id: def[0],
        accessorKey: def[0],
        header: toTitleCase(def[0]),
        accessorFn: def[1],
        type: def[2] ?? columnTypes[def[0]],
      }
    })
  } else {
    columns = Object.keys(tableColumns).map(key => ({
      id: key,
      accessorKey: key,
      header: toTitleCase(key),
      type: columnTypes[key],
    }))
    // Remove primary autoincrement and auto timestamp columns
    columns = columns.filter((column) => {
      const columnsToExclude = metadata.primaryAutoincrementColumns.concat(metadata.autoTimestampColumns)
      return !columnsToExclude.includes(column.accessorKey)
    })
    // Also remove foreign keys
    const foreignKeys = getTableForeignKeys(cfg.model)
    columns = columns.filter((column) => {
      return !foreignKeys.some(foreignKey => foreignKey.column.name === column.accessorKey)
    })
  }
  // change column type to datetime-local if it is a datetime column
  const datetimeColumns = metadata.datetimeColumns.concat(metadata.autoTimestampColumns)
  columns = columns.map((column) => {
    if (datetimeColumns.includes(column.accessorKey)) {
      return { ...column, type: 'datetime-local' }
    }
    return column
  })
  return columns
}

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
  const cfg = getModelConfig(modelLabel)
  const model = cfg.model

  const config = useRuntimeConfig()
  const apiPrefix = config.public.apiPrefix

  const tableColumns = getTableColumns(model)

  const columnTypes = zodToListSpec(cfg.create?.schema as any)
  const metadata = getTableMetadata(model)

  const spec = {
    endpoint: cfg.list?.endpoint ?? `${apiPrefix}/${modelLabel}`,
    updatePage: cfg.update?.enabled ? { name: 'autoadmin-update', params: { modelLabel: `${modelLabel}` } } : undefined,
    deleteEndpoint: cfg.delete?.enabled ? (cfg.delete?.endpoint ?? `${apiPrefix}/${modelLabel}`) : undefined,
    title: cfg.list?.title ?? toTitleCase(cfg.label ?? modelLabel),
    columns: getListColumns(cfg, tableColumns, columnTypes, metadata),
    lookupColumnName: cfg.lookupColumnName,
  }

  const db = useDb()

  const columnNames = spec.columns.map(column => column.accessorKey as keyof typeof model)
  const hasAccessorFn = spec.columns.some(column => column.accessorFn)
  let baseQuery
  if (hasAccessorFn) {
    // we need to select all columns from the table if we have accessor functions because the accessor functions may need to access other columns
    baseQuery = db.select().from(model)
  } else {
  // only select the required column names from the table, not all columns
    const selectedColumns = Object.fromEntries(
      columnNames
        .filter(key => key in tableColumns)
        .map(key => [key, model[key]]),
    )
    // add lookup column to the selected columns if it does not exist
    if (!selectedColumns[cfg.lookupColumnName]) {
      selectedColumns[cfg.lookupColumnName] = model[cfg.lookupColumnName]
    }
    baseQuery = db.select(selectedColumns).from(model)
  }
  const countQuery = db.select({ resultCount: count() }).from(model)

  try {
    const response = await getPaginatedResponse<typeof model>(baseQuery, countQuery, query)
    if (hasAccessorFn) {
    // run the columns through the accessor functions
      response.results = response.results.map((result) => {
      // loop through the columns and run the accessor functions
        spec.columns.forEach((column) => {
          if (column.accessorFn) {
            result[column.accessorKey] = column.accessorFn(result)
          }
        })
        return result
      })
      // only return the columns that have accessor keys or the lookup column
      response.results = response.results.map((result) => {
        return Object.fromEntries(
          Object.entries(result).filter(([key]) => spec.columns.some(column => column.accessorKey === key) || key === cfg.lookupColumnName),
        )
      })
    }
    return {
      ...response,
      spec,
    }
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
      const fieldName = `___${relation.name}___${relation.otherColumn.name}`
      if (preprocessed[fieldName]) {
        const selfValue = result[0][relation.selfForeignColumn.name]
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
      const fieldName = `___${relation.name}___${relation.otherColumn.name}`
      if (preprocessed[fieldName]) {
        const selfValue = result[0][relation.selfForeignColumn.name]
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
