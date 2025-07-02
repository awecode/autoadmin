import type { AnyColumn, Table } from 'drizzle-orm'
import type { FieldSpec, FormSpec } from './form'
import { eq, getTableColumns, getTableName, inArray } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { toTitleCase } from './string'

export function getRowLabel(row: Record<string, any>) {
  // TODO: get from formspec if available
  return row.name ?? row.title ?? row.label ?? Object.values(row)[0]
}
export interface M2MRelationSelf {
  selfTable: Table
  selfColumn: AnyColumn
  selfColumnName: string
  selfForeignColumn: AnyColumn
  selfForeignColumnName: string
}
export interface M2MRelation extends M2MRelationSelf {
  name: string
  m2mTable: Table
  otherTable: Table
  otherColumn: AnyColumn
  otherColumnName: string
  otherForeignColumn: AnyColumn
  otherForeignColumnName: string
}

export interface O2MRelation {
  selfTable: Table
  foreignTable: Table
  selfPrimaryColumn: AnyColumn
  foreignPrimaryColumn: AnyColumn
  foreignRelatedColumn: AnyColumn
  fieldName: string
}

export function getPrimaryKeyColumn(table: Table) {
  const primaryKeyColumns = Object.entries(getTableColumns(table)).filter(([_, column]) => column.primary).map(([_, column]) => column)
  if (primaryKeyColumns.length === 0) {
    throw new Error(`Table ${getTableName(table)} has no primary key.`)
  }
  if (primaryKeyColumns.length > 1) {
    throw new Error(`Table ${getTableName(table)} has multiple primary keys.`)
  }
  return primaryKeyColumns[0]
}

export function parseO2mRelation(modelConfig: AdminModelConfig, table: Table, name: string): O2MRelation {
  const model = modelConfig.model
  const modelLabel = modelConfig.label
  const foreignPrimaryColumn = getPrimaryKeyColumn(table)
  const selfPrimaryColumn = getPrimaryKeyColumn(model)
  const foreignKeys = getTableForeignKeys(table)
  const foreignRelatedColumn = foreignKeys.find(fk => fk.foreignTable === model) as unknown as AnyColumn
  if (!foreignRelatedColumn) {
    throw new Error(`One-to-many relation requires a foreign key in related table. None found for ${modelLabel} in ${getTableName(table)} for the relation ${modelLabel} -> ${name}.`)
  }
  return {
    selfTable: model,
    foreignTable: table,
    selfPrimaryColumn,
    foreignPrimaryColumn,
    foreignRelatedColumn,
    fieldName: `___o2m___${name}___${foreignPrimaryColumn.name}`,
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
          selfColumnName: relation.columnName,
          selfForeignColumn: relation.foreignColumn,
          selfForeignColumnName: relation.foreignColumnName,
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
          otherColumnName: relation.columnName,
          otherForeignColumn: relation.foreignColumn,
          otherForeignColumnName: relation.foreignColumnName,
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
      const column = columns[i]
      const foreignColumn = foreignColumns[i]

      relations.push({
        name: column.name,
        column,
        columnName: column.name,
        table,
        foreignColumn,
        foreignColumnName: foreignColumn.name,
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
      if (columns[i].name === columnName) {
        relations.push({
          name: columnName,
          columnName,
          table,
          foreignColumn,
          foreignColumnName: foreignColumn.name,
          foreignTable: foreignColumn.table,
        })
      }
    }
  }

  return relations
}

export const addForeignKeysToFormSpec = async (formSpec: FormSpec, modelLabel: string, relations: ReturnType<typeof getTableForeignKeys>) => {
  const updatedFormSpec = { ...formSpec, fields: [...formSpec.fields] }

  await Promise.all(relations.map(async (relation) => {
    const fieldIndex = updatedFormSpec.fields.findIndex(field => field.name === relation.columnName)
    if (fieldIndex !== -1) {
      const field = { ...updatedFormSpec.fields[fieldIndex] }
      field.type = 'relation'
      //   strip id from field label
      field.label = field.label.replace(' Id', '')
      if (formSpec.values?.[relation.columnName]) {
        const db = useDb()
        const rows = await db.select().from(relation.foreignTable).where(eq(relation.foreignTable[relation.foreignColumnName], formSpec.values[relation.columnName]))
        field.selectItems = rows.map(row => ({
          label: getRowLabel(row),
          value: row[relation.foreignColumnName],
        }))
      }
      field.choicesEndpoint = `/api/autoadmin/formspec/${modelLabel}/choices/${relation.columnName}`

      updatedFormSpec.fields[fieldIndex] = field
    } else {
      console.error(`Field ${relation.columnName} not found in form spec`)
    }
  }))

  return updatedFormSpec
}

export const addO2mRelationsToFormSpec = async (formSpec: FormSpec, modelConfig: AdminModelConfig) => {
  const o2mTables = modelConfig.o2m
  if (!o2mTables) {
    return formSpec
  }
  const modelLabel = modelConfig.label
  const updatedFields = formSpec.fields

  // Process all relations in parallel
  await Promise.all(Object.entries(o2mTables).map(async ([name, table]) => {
    const relationData = parseO2mRelation(modelConfig, table, name)

    const field: FieldSpec = {
      name: relationData.fieldName,
      type: 'relation-many' as const,
      label: toTitleCase(name),
      choicesEndpoint: `/api/autoadmin/formspec/${modelLabel}/choices-o2m/___${name}___${relationData.foreignPrimaryColumn.name}`,
      required: false,
      rules: {},
      selectItems: [],
    }
    // if values are provided, use them to get the initial selection of o2m relations
    if (formSpec.values) {
      // find primary key value, required for initial selection of o2m relations
      const selfPrimaryColumn = getPrimaryKeyColumn(modelConfig.model)
      const selfPrimaryValue = formSpec.values[selfPrimaryColumn.name]
      // if selfPrimaryValue is available, get o2m values
      if (selfPrimaryValue === undefined || selfPrimaryValue === null) {
        throw new Error(`Primary key value is required for one-to-many relation. None found for ${modelLabel}.`)
      }
      const db = useDb()
      const rows = await db.select().from(table).where(eq(table[relationData.foreignRelatedColumn.name], selfPrimaryValue))
      field.selectItems = rows.map(row => ({
        label: getRowLabel(row),
        value: row[relationData.foreignPrimaryColumn.name],
      }))
      formSpec.values[relationData.fieldName] = field.selectItems.map(item => item.value)
    }
    updatedFields.push(field)
  }))

  return { ...formSpec, fields: updatedFields }
}

export const addM2mRelationsToFormSpec = async (formSpec: FormSpec, modelLabel: string, relations: M2MRelation[]) => {
  const updatedFields = formSpec.fields

  // Process all relations in parallel
  await Promise.all(relations.map(async (relation) => {
    const fieldName = `___${relation.name}___${relation.otherColumnName}`
    const field: FieldSpec = {
      name: fieldName,
      type: 'relation-many' as const,
      label: toTitleCase(relation.name),
      choicesEndpoint: `/api/autoadmin/formspec/${modelLabel}/choices-many/${fieldName}`,
      required: false,
      rules: {},
      selectItems: [],
    }
    if (formSpec.values) {
      const db = useDb()
      const selfValue = formSpec.values[relation.selfForeignColumnName]
      const m2mValues = await db.select().from(relation.m2mTable).where(eq(relation.m2mTable[relation.selfColumnName], selfValue))
      const otherValues = m2mValues.map(value => value[relation.otherColumnName])
      let rows: any[] = []
      if (otherValues.length > 0) {
        rows = await db.select().from(relation.otherTable).where(
          inArray(relation.otherTable[relation.otherForeignColumnName], otherValues),
        )
      }
      field.selectItems = rows.map(row => ({
        label: getRowLabel(row),
        value: row[relation.otherForeignColumnName],
      }))
      formSpec.values[fieldName] = field.selectItems.map(item => item.value)
    }
    updatedFields.push(field)
  }))

  return { ...formSpec, fields: updatedFields }
}
