import type { Table } from 'drizzle-orm'
import type { FormSpec } from './form'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { useDb } from '~~/server/utils/db'

export function getTableRelations(table: Table) {
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
      })
    }
  }

  return relations
}

function getRowLabel(row: Record<string, any>) {
  return row.name ?? row.title ?? row.label ?? Object.values(row)[0]
}

export const addRelationToFormSpec = async (formSpec: FormSpec, relations: ReturnType<typeof getTableRelations>) => {
  relations.forEach(async (relation) => {
    // find field with name relation.columnName
    const field = formSpec.fields.find(field => field.name === relation.columnName)
    if (field) {
      field.type = 'relation'
      //   strip id from field label
      field.label = field.label.replace('Id', '')
      //   get all values from relation.foreignTable
      if (import.meta.server) {
        const db = useDb()
        const rows = await db.select().from(relation.foreignTable)
        field.selectItems = rows.map(row => ({
          label: getRowLabel(row),
          value: row[relation.foreignColumnName],
        }))
      } else {
        // TODO: get values from API
        field.selectItems = [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }]
      }
    }
  })
}
