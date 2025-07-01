import type { AnyColumn, Relations, Table } from 'drizzle-orm'

import type { FieldSpec, FormSpec } from './form'
import { eq, inArray } from 'drizzle-orm'
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

export function parseM2mRelations(model: Table, m2mTables: Record<string, Table>) {
  const m2mRelations: M2MRelation[] = []

  Object.entries(m2mTables).forEach(([name, table]) => {
    const rels = getTableForeignKeys(table, 'many')
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

  // const relationData = m2mTables.map(table => getTableForeignKeys(table, 'many'))
  // const m2mRelationsInJunctionTable: M2MRelation[] = []

  // // debugger
  // const rels = getTableForeignKeys(value.target, 'many')
  // let selfData: M2MRelationSelf
  // rels.forEach((relation) => {
  //   if (relation.foreignTable === model) {
  //     selfData = {
  //       selfTable: relation.foreignTable,
  //       selfColumn: relation.column,
  //       selfColumnName: relation.columnName,
  //       selfForeignColumn: relation.foreignColumn,
  //       selfForeignColumnName: relation.foreignColumnName,
  //     }
  //   }
  // })
  // rels.forEach((relation) => {
  //   if (relation.foreignTable !== model) {
  //     const m2mRelation = {
  //       name: value.name,
  //       m2mTable: value.target,
  //       ...selfData,
  //       otherTable: relation.foreignTable,
  //       otherColumn: relation.column,
  //       otherColumnName: relation.columnName,
  //       otherForeignColumn: relation.foreignColumn,
  //       otherForeignColumnName: relation.foreignColumnName,
  //     }
  //     m2mRelationsInJunctionTable.push(m2mRelation)
  //   }
  // })

  // console.log(m2mRelationsInJunctionTable)
  // return { m2m: m2mRelationsInJunctionTable }
}

export function getTableForeignKeys(table: Table, type?: 'one' | 'many') {
  type = type || 'one'
  const relations = []
  const foreignKeys = getTableConfig(table).foreignKeys

  if (!foreignKeys || !Array.isArray(foreignKeys)) {
    return []
  }

  for (const fk of foreignKeys) {
    const reference = fk.reference()
    const columns = reference.columns
    const foreignColumns = reference.foreignColumns

    // Loop through each column pair
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
        type,
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

    // Loop through each column pair
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

export const addForeignKeysToFormSpec = async (formSpec: FormSpec, modelLabel: string, relations: ReturnType<typeof getTableForeignKeys>, values?: Record<string, any>) => {
  const updatedFormSpec = { ...formSpec, fields: [...formSpec.fields] }

  // Process all relations in parallel
  await Promise.all(relations.map(async (relation) => {
    // find field with name relation.columnName
    const fieldIndex = updatedFormSpec.fields.findIndex(field => field.name === relation.columnName)
    if (fieldIndex !== -1) {
      const field = { ...updatedFormSpec.fields[fieldIndex] }
      field.type = 'relation'
      //   strip id from field label
      field.label = field.label.replace(' Id', '')

      //   get all values from relation.foreignTable
      // if (import.meta.server) {
      //   const db = useDb()
      //   const rows = await db.select().from(relation.foreignTable)
      //   field.selectItems = rows.map(row => ({
      //     label: getRowLabel(row),
      //     value: row[relation.foreignColumnName],
      //   }))
      // }
      if (values?.[relation.columnName]) {
        const db = useDb()
        const rows = await db.select().from(relation.foreignTable).where(eq(relation.foreignTable[relation.foreignColumnName], values[relation.columnName]))
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

export const addM2mRelationsToFormSpec = async (formSpec: FormSpec, modelLabel: string, relations: M2MRelation[], values?: Record<string, any[]>) => {
  const updatedFormSpec = { ...formSpec, fields: [...formSpec.fields] }

  // Process all relations in parallel
  await Promise.all(relations.map(async (relation) => {
    const name = `___${relation.name}___${relation.otherColumnName}`
    const field: FieldSpec = {
      name,
      type: 'relation-many' as const,
      label: toTitleCase(relation.name),
      choicesEndpoint: `/api/autoadmin/formspec/${modelLabel}/choices-many/${name}`,
      required: false,
      rules: {},
      selectItems: [],
    }
    if (values?.[name]) {
      const db = useDb()
      // Handle array of values for many-to-many relations
      const rows = await db.select().from(relation.otherTable).where(
        inArray(relation.otherTable[relation.otherForeignColumnName], values[name]),
      )
      field.selectItems = rows.map(row => ({
        label: getRowLabel(row),
        value: row[relation.otherForeignColumnName],
      }))
    }
    updatedFormSpec.fields.push(field)
  }))

  return updatedFormSpec
}
