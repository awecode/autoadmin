import type { Table } from 'drizzle-orm'
import type { FormSpec } from './form'
import process from 'node:process'
import { useDb } from '~~/server/utils/db'

/**
 * Represents a single column relation extracted from a Drizzle table
 */
export interface ColumnRelation {
  columnName: string
  foreignColumn: any
  foreignColumnName: string
  foreignTable: any
}

/**
 * Gets relations from a Drizzle table by extracting foreign key information
 * @param table - The Drizzle table object
 * @returns Array of column relations
 */
export function getTableRelations(table: Table): ColumnRelation[] {
  const relations: ColumnRelation[] = []

  if (!table) {
    throw new Error('Table object is required')
  }

  // Get symbols from the table
  const symbols = Object.getOwnPropertySymbols(table)

  // Find the foreign keys symbol
  const fkSymbol = symbols.find(
    s => s.toString() === 'Symbol(drizzle:SQLiteInlineForeignKeys)',
  )
  if (!fkSymbol) {
    // No foreign keys found
    return relations
  }

  // Get foreign keys using the symbol
  const foreignKeys = (table as any)[fkSymbol]

  if (!foreignKeys || !Array.isArray(foreignKeys)) {
    return relations
  }

  // Process each foreign key
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

export const addRelationToFormSpec = async (formSpec: FormSpec, relations: ColumnRelation[]) => {
  relations.forEach(async (relation) => {
    // find field with name relation.columnName
    const field = formSpec.fields.find(field => field.name === relation.columnName)
    if (field) {
      field.type = 'select'
      field.rules = {}
      //   strip id from field label
      field.label = field.label.replace('Id', '')
      //   get all ids from relation.foreignTable
      if (process.server) {
        const db = useDb()
        const rows = await db.select().from(relation.foreignTable)
        field.enumValues = rows.map(row => row.id)
      } else {
        field.enumValues = ['1', '2']
      }
    } else {
      formSpec.fields.push({
        name: relation.columnName,
        label: relation.columnName,
        type: 'select',
        required: true,
        rules: {},
        enumValues: [],
        defaultValue: null,
      })
    }
  })
}
