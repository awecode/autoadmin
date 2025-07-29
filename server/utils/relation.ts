import type { AdminModelConfig } from '#layers/autoadmin/composables/registry'
import type { AnyColumn, Table } from 'drizzle-orm'
import type { DbType } from './db'
import type { FieldSpec, FormSpec } from './form'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { and, eq, getTableColumns, getTableName, inArray, not } from 'drizzle-orm'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { getEnabledStatuses, getLabelColumnFromModel } from './autoadmin'
import { useDb } from './db'
import { colKey, handleDrizzleError } from './drizzle'

const NOTNULL_CONSTRAINT_CODES = ['SQLITE_CONSTRAINT_NOTNULL']

interface M2MRelationSelf {
  selfTable: Table
  selfColumn: AnyColumn
  selfForeignColumn: AnyColumn
}
export interface M2MRelation extends M2MRelationSelf {
  name: string
  m2mTable: Table
  otherTable: Table
  otherColumn: AnyColumn
  otherForeignColumn: AnyColumn
}

export function getPrimaryKeyColumn(table: Table) {
  const primaryKeyColumns = Object.entries(getTableColumns(table)).filter(([_, column]) => column.primary).map(([_, column]) => column)
  if (primaryKeyColumns.length === 0) {
    throw new Error(`Table ${getTableName(table)} has no primary key.`)
  }
  if (primaryKeyColumns.length > 1) {
    throw new Error(`Table ${getTableName(table)} has multiple primary keys.`)
  }
  return primaryKeyColumns[0]!
}

export function parseO2mRelation<T extends Table>(cfg: AdminModelConfig<T>, table: Table, name: string) {
  const model = cfg.model
  const modelKey = cfg.key
  const foreignPrimaryColumn = getPrimaryKeyColumn(table)
  const selfPrimaryColumn = getPrimaryKeyColumn(model)
  const foreignKeys = getTableForeignKeys(table)
  const foreignRelatedColumnKey = foreignKeys.find(fk => fk.foreignTable === model)
  if (!foreignRelatedColumnKey) {
    throw new Error(`One-to-many relation requires a foreign key in related table. None found for ${modelKey} in ${getTableName(table)} for the relation ${modelKey} -> ${name}.`)
  }
  return {
    selfTable: model,
    foreignTable: table,
    selfPrimaryColumn,
    foreignPrimaryColumn,
    foreignRelatedColumn: foreignRelatedColumnKey.column,
    fieldName: `___o2m___${name}___${colKey(foreignPrimaryColumn)}`,
  }
}

export function parseM2mRelations(model: Table, m2mTables: Record<string, Table>) {
  const m2mRelations: M2MRelation[] = []

  Object.entries(m2mTables).forEach(([name, table]) => {
    const rels = getTableForeignKeys(table)
    let selfData: M2MRelationSelf
    rels.forEach((relation) => {
      if (relation.foreignTable === model) {
        selfData = {
          selfTable: relation.foreignTable,
          selfColumn: relation.column,
          selfForeignColumn: relation.foreignColumn,
        }
      }
    })
    rels.forEach((relation) => {
      if (relation.foreignTable !== model) {
        const m2mRelation = {
          name,
          m2mTable: table,
          ...selfData,
          otherTable: relation.foreignTable,
          otherColumn: relation.column,
          otherForeignColumn: relation.foreignColumn,
        }
        m2mRelations.push(m2mRelation)
      }
    })
  })
  return m2mRelations
}

export function getTableForeignKeys(table: Table) {
  const relations = []
  const foreignKeys = getTableConfig(table).foreignKeys

  if (!foreignKeys || !Array.isArray(foreignKeys)) {
    return []
  }

  for (const fk of foreignKeys) {
    const reference = fk.reference()
    const columns = reference.columns
    const foreignColumns = reference.foreignColumns

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]!
      const foreignColumn = foreignColumns[i]
      if (!foreignColumn) {
        continue
      }
      relations.push({
        name: colKey(column),
        column,
        table,
        foreignColumn,
        foreignTable: foreignColumn.table,
      })
    }
  }

  return relations
}

export function getTableForeignKeysByColumn(table: Table, columnName: string) {
  const relations = []
  const foreignKeys = getTableConfig(table).foreignKeys

  if (!foreignKeys || !Array.isArray(foreignKeys)) {
    return []
  }

  for (const fk of foreignKeys) {
    const reference = fk.reference()
    const columns = reference.columns
    const foreignColumns = reference.foreignColumns

    for (let i = 0; i < columns.length; i++) {
      const foreignColumn = foreignColumns[i]
      if (!foreignColumn) {
        continue
      }
      if (colKey(columns[i]!) === columnName) {
        relations.push({
          name: columnName,
          columnName,
          table,
          foreignColumn,
          foreignTable: foreignColumn.table,
        })
      }
    }
  }

  return relations
}

export const addForeignKeysToFormSpec = async (formSpec: FormSpec, cfg: AdminModelConfig, relations: ReturnType<typeof getTableForeignKeys>) => {
  const updatedFormSpec = { ...formSpec, fields: [...formSpec.fields] }

  await Promise.all(relations.map(async (relation) => {
    const fieldIndex = updatedFormSpec.fields.findIndex(field => field.name === colKey(relation.column))
    // check if field is in form spec, if not found, ignore because it may not be specified through form fields
    if (fieldIndex !== -1) {
      const field = { ...updatedFormSpec.fields[fieldIndex] } as FieldSpec
      field.type = 'relation'
      //   strip id from field label
      field.label = (field.label || field.name).replace(' Id', '')
      if (formSpec.values?.[colKey(relation.column)]) {
        const db = useDb()
        // TODO only select the columns that are needed for the form spec
        const rows = await db.select().from(relation.foreignTable).where(eq(relation.foreignColumn, formSpec.values[colKey(relation.column)]))
        field.options = rows.map(row => ({
          label: row[getLabelColumnFromModel(relation.foreignTable)],
          value: row[colKey(relation.foreignColumn)],
        }))
      }
      const enabledStatuses = getEnabledStatuses(relation.foreignTable)
      field.relationConfig = {
        choicesEndpoint: `${cfg.apiPrefix}/formspec/${cfg.key}/choices/${colKey(relation.column)}`,
        relatedConfigKey: enabledStatuses?.key,
        enableCreate: enabledStatuses?.create,
        enableUpdate: enabledStatuses?.update,
        foreignRelatedColumnName: colKey(relation.foreignColumn),
        foreignLabelColumnName: getLabelColumnFromModel(relation.foreignTable),
      }

      updatedFormSpec.fields[fieldIndex] = field
    }
  }))

  return updatedFormSpec
}

export const addO2mRelationsToFormSpec = async (formSpec: FormSpec, cfg: AdminModelConfig) => {
  const o2mTables = cfg.o2m
  if (!o2mTables) {
    return formSpec
  }
  const modelKey = cfg.key
  const updatedFields = formSpec.fields

  // Process all relations in parallel
  await Promise.all(Object.entries(o2mTables).map(async ([name, table]) => {
    const relationData = parseO2mRelation(cfg, table, name)
    const enabledStatuses = getEnabledStatuses(table)

    const field: FieldSpec = {
      name: relationData.fieldName,
      type: 'relation-many' as const,
      label: toTitleCase(name),
      relationConfig: {
        choicesEndpoint: `${cfg.apiPrefix}/formspec/${modelKey}/choices-o2m/___${name}___${colKey(relationData.foreignPrimaryColumn)}`,
        relatedConfigKey: enabledStatuses?.key,
        enableCreate: enabledStatuses?.create,
        enableUpdate: enabledStatuses?.update,
        foreignRelatedColumnName: colKey(relationData.foreignPrimaryColumn),
        foreignLabelColumnName: getLabelColumnFromModel(table),
      },
      required: false,
      rules: {},
      options: [],
    }
    // if values are provided, use them to get the initial selection of o2m relations
    if (formSpec.values) {
      // find primary key value, required for initial selection of o2m relations
      const selfPrimaryColumn = getPrimaryKeyColumn(cfg.model)
      const selfPrimaryValue = formSpec.values[colKey(selfPrimaryColumn)]
      // if selfPrimaryValue is available, get o2m values
      if (selfPrimaryValue === undefined || selfPrimaryValue === null) {
        throw new Error(`Primary key value is required for one-to-many relation. None found for ${modelKey}.`)
      }
      const db = useDb()
      // const rows = await db.select().from(table).where(eq(table[colKey(relationData.foreignRelatedColumn)], selfPrimaryValue))
      // TODO only select the columns that are needed for the form spec
      const rows = await db.select().from(table).where(eq(relationData.foreignRelatedColumn, selfPrimaryValue))
      field.options = rows.map(row => ({
        label: row[getLabelColumnFromModel(table)],
        value: row[colKey(relationData.foreignPrimaryColumn)],
      }))
      formSpec.values[relationData.fieldName] = (field.options as { label: string, value: string }[]).map(item => item.value)
    }
    updatedFields.push(field)
  }))

  return { ...formSpec, fields: updatedFields }
}

export const addM2mRelationsToFormSpec = async (formSpec: FormSpec, cfg: AdminModelConfig, relations: M2MRelation[]) => {
  const updatedFields = formSpec.fields

  // Process all relations in parallel
  await Promise.all(relations.map(async (relation) => {
    const fieldName = `___${relation.name}___${colKey(relation.otherColumn)}`
    const enabledStatuses = getEnabledStatuses(relation.otherTable)
    const field: FieldSpec = {
      name: fieldName,
      type: 'relation-many' as const,
      label: toTitleCase(relation.name),
      relationConfig: {
        choicesEndpoint: `${cfg.apiPrefix}/formspec/${cfg.key}/choices-many/${fieldName}`,
        relatedConfigKey: enabledStatuses?.key,
        enableCreate: enabledStatuses?.create,
        enableUpdate: enabledStatuses?.update,
        foreignRelatedColumnName: colKey(relation.otherForeignColumn),
        foreignLabelColumnName: getLabelColumnFromModel(relation.otherTable),
      },
      required: false,
      rules: {},
      options: [],
    }
    if (formSpec.values) {
      const db = useDb()
      const selfValue = formSpec.values[colKey(relation.selfForeignColumn)]
      // TODO only select the columns that are needed for the form spec
      const result = await db
        .select({ other: relation.otherTable })
        .from(relation.otherTable)
        .innerJoin(
          relation.m2mTable,
          and(
            eq(relation.selfColumn, selfValue),
            eq(
              relation.otherForeignColumn,
              relation.otherColumn,
            ),
          ),
        )
      if (result.length > 0) {
        const rows = result.map(row => row.other)
        field.options = rows.map(row => ({
          label: row[getLabelColumnFromModel(relation.otherTable)],
          value: row[colKey(relation.otherForeignColumn)],
        }))
        formSpec.values[fieldName] = (field.options as { label: string, value: string }[]).map(item => item.value)
      }
    }
    updatedFields.push(field)
  }))

  return { ...formSpec, fields: updatedFields }
}

export async function saveO2mRelation<T extends Table>(db: DbType, cfg: AdminModelConfig<T>, preprocessed: any, result: { [x: string]: any }[]) {
  if (cfg.o2m) {
    const modelKey = cfg.key
    for (const [name, table] of Object.entries(cfg.o2m)) {
      const relationData = parseO2mRelation(cfg, table, name)
      const fieldName = relationData.fieldName
      const newValues = preprocessed[fieldName]
      if (newValues) {
        const selfValue = result[0]![colKey(relationData.selfPrimaryColumn)]
        // Step 1: Unset foreignRelatedColumn for all rows pointing to selfValue, except those in newValues
        try {
          await db.update(table).set({ [colKey(relationData.foreignRelatedColumn)]: null }).where(and(eq(relationData.foreignRelatedColumn, selfValue), not(inArray(relationData.foreignPrimaryColumn, newValues))))
        } catch (error) {
          if (error instanceof DrizzleQueryError) {
            if (error.cause && 'code' in error.cause && typeof error.cause.code === 'string' && NOTNULL_CONSTRAINT_CODES.includes(error.cause.code)) {
              const userFriendlyMessage = `Cannot remove the relation to ${modelKey} (${selfValue}) from existing records in ${getTableName(table)} because this field is required and cannot be null.`
              throw createError({
                statusCode: 400,
                // statusMessage: `Cannot unset this ${colKey(foreignRelatedColumn)} (${selfValue}) in previously existing records in ${getTableName(table)} because it can not be empty/null.`,
                statusMessage: `Cannot remove the relation to ${modelKey} (${selfValue}) from existing records in ${getTableName(table)} because this field is required and cannot be null.`,
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
          await db.update(table).set({ [colKey(relationData.foreignRelatedColumn)]: selfValue }).where(inArray(relationData.foreignPrimaryColumn, newValues))
        }
      }
    }
  }
}

export async function saveM2mRelation(db: DbType, relation: M2MRelation, selfValue: any, newValues: any[]) {
  // if the m2m table has only two columns, we can delete and insert all at once
  if (Object.keys(getTableColumns(relation.m2mTable)).length === 2) {
    await db.delete(relation.m2mTable).where(eq(relation.selfColumn, selfValue))
    if (newValues.length > 0) {
      const values = newValues.map(value => ({
        [colKey(relation.selfColumn)]: selfValue,
        [colKey(relation.otherColumn)]: value,
      }))
      await db.insert(relation.m2mTable).values(values)
    }
    return
  }
  // if the m2m table has more than two columns, there may be additional columns in junction table, so we can't just delete and insert all at once
  // we need to preserve the exisiting relationships which are also in the new values

  // Get existing relationships
  const existing = await db.select()
    .from(relation.m2mTable)
    .where(eq(relation.selfColumn, selfValue))

  const existingOtherIds = existing.map(row => row[colKey(relation.otherColumn)])

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
        [colKey(relation.otherColumn)]: otherForeignColumnValue,
        [colKey(relation.selfColumn)]: selfValue,
      })),
    )
  }
}
