import type { Table } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'

export interface TableMetadata {
  primaryAutoincrementColumns: string[]
  datetimeColumns: string[]
  autoTimestampColumns: string[]
}

export function getTableMetadata(table: Table): TableMetadata {
  const metadata: TableMetadata = {
    primaryAutoincrementColumns: [],
    datetimeColumns: [],
    autoTimestampColumns: [],
  }

  if (!table) {
    throw new Error('Table object is required')
  }

  // Loop through each column to extract metadata
  for (const [columnName, column] of Object.entries(getTableColumns(table))) {
    if (column.dataType === 'number' && column.primary === true && column.config?.autoIncrement === true) {
      metadata.primaryAutoincrementColumns.push(columnName)
    }

    // // Check for datetime columns with timestamp_ms mode
    if (column.dataType === 'date' && column.config?.mode === 'timestamp_ms') {
      if (column.config?.default) {
        metadata.autoTimestampColumns.push(columnName)
      } else {
        metadata.datetimeColumns.push(columnName)
      }
    }
  }

  return metadata
}

export const useMetadataOnFormSpec = (formSpec: FormSpec, metadata: TableMetadata): FormSpec => {
  const updatedFormSpec = { ...formSpec }

  // Filter out primary autoincrement columns
  updatedFormSpec.fields = updatedFormSpec.fields.filter(
    field => !metadata.primaryAutoincrementColumns.includes(field.name),
  )

  // Update datetime columns
  updatedFormSpec.fields = updatedFormSpec.fields.map((field) => {
    if (metadata.datetimeColumns.includes(field.name)) {
      return { ...field, type: 'datetime-local' }
    }
    return field
  })

  // Filter out auto timestamp columns
  updatedFormSpec.fields = updatedFormSpec.fields.filter(
    field => !metadata.autoTimestampColumns.includes(field.name),
  )

  return updatedFormSpec
}
