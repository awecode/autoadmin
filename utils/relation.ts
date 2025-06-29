import type { AnyColumn, Relation, RelationConfig, Relations, Table } from 'drizzle-orm'
import type { FormSpec } from './form'
import { eq } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'

export function getRowLabel(row: Record<string, any>) {
  // TODO: get from formspec if available
  return row.name ?? row.title ?? row.label ?? Object.values(row)[0]
}

export function parseRelations(model: Table, relations: Record<string, Relations>) {
  const xyz = relations.platformRelations.config({
    one(target: Table, config?: RelationConfig<string, string, AnyColumn<{ tableName: string }>[]>) {
      return {
        withFieldName(name) {
          return { name, type: 'one', target, config }
        },
      }
    },
    many(target: Table, config?: { relationName: string }) {
      return {
        withFieldName(name) {
          return { name, type: 'many', target, config }
        },
      }
    },
  }) as unknown as Record<string, { name: string, type: 'one' | 'many', target: Table }>
  const m2mRelationsInJunctionTable: ReturnType<typeof getTableRelations> = []
  for (const [key, value] of Object.entries(xyz)) {
    // console.log(key, value.name, value.type, value.target)
    if (value.type === 'many') {
      const rels = getTableRelations(value.target, 'many')
      rels.forEach((relation) => {
        if (relation.foreignTable !== model) {
          m2mRelationsInJunctionTable.push(relation)
        }
      })
    }
  }
  return m2mRelationsInJunctionTable
}

export function getTableRelations(table: Table, type?: 'one' | 'many') {
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
        columnName: column.name,
        foreignColumn,
        foreignColumnName: foreignColumn.name,
        foreignTable: foreignColumn.table,
        type,
      })
    }
  }

  return relations
}

export function getTableRelationsByColumn(table: Table, columnName: string) {
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
          columnName,
          foreignColumn,
          foreignColumnName: foreignColumn.name,
          foreignTable: foreignColumn.table,
        })
      }
    }
  }

  return relations
}

export const addRelationToFormSpec = async (formSpec: FormSpec, modelLabel: string, relations: ReturnType<typeof getTableRelations>, values?: Record<string, any>) => {
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
    }
  }))

  return updatedFormSpec
}
