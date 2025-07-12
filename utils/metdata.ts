import type { Column } from 'drizzle-orm'
import { useDb } from '#layers/autoadmin/server/utils/db'
import { sql, SQL } from 'drizzle-orm'

export interface TableMetadata {
  primaryAutoincrementColumns: string[]
  datetimeColumns: string[]
  autoTimestampColumns: string[]
  defaultValues: Record<string, any>
}

export function getTableMetadata(columns: Record<string, Column>): TableMetadata {
  const metadata: TableMetadata = {
    primaryAutoincrementColumns: [],
    datetimeColumns: [],
    autoTimestampColumns: [],
    defaultValues: {},
  }
  // Loop through each column to extract metadata
  for (const [columnName, column] of Object.entries(columns)) {
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

    if (column.config?.default) {
      metadata.defaultValues[columnName] = column.config?.default
    }
  }

  return metadata
}

const isSql = (v: unknown): v is SQL => v instanceof SQL || (
  v && typeof v === 'object' && 'queryChunks' in v
)

async function resolveDefault(db: ReturnType<typeof useDb>, raw: unknown) {
  if (isSql(raw)) {
    // recognise CURRENT_TIMESTAMP expression and return the current timestamp without involving the database
    // TODO Maybe do the same for other SQL expressions like NOW(), unixepoch(), etc.
    // TODO Maybe the user is relying on the database to set using the correct timezone.
    if (raw.queryChunks?.[0]?.value?.[0] === 'CURRENT_TIMESTAMP') {
      return new Date().toISOString()
    } else {
      const selectSql = sql`SELECT ${raw}`
      // TODO db.execute for other dialects
      try {
        const result = await db.run(selectSql)
        return result.rows?.[0]?.[0]
      } catch (error) {
        console.error('Error resolving default value', error)
        return raw
      }
    }
    // any other SQL default → let the DB handle it
    return undefined
  }
  return raw
}

export const useMetadataOnFormSpec = async (
  formSpec: FormSpec,
  metadata: TableMetadata,
): Promise<FormSpec> => {
  let fields = formSpec.fields
  const db = useDb()

  // Drop primary autoincrement columns
  fields = fields.filter(
    field => !metadata.primaryAutoincrementColumns.includes(field.name),
  )

  // Convert datetime columns to datetime-local
  fields = fields.map(field =>
    metadata.datetimeColumns.includes(field.name)
      ? { ...field, type: 'datetime-local' }
      : field,
  )

  // Drop auto-timestamp columns
  fields = fields.filter(
    field => !metadata.autoTimestampColumns.includes(field.name),
  )

  // Resolve async defaults
  fields = await Promise.all(
    fields.map(async (field) => {
      const cfgDefault = metadata.defaultValues[field.name]
      if (cfgDefault !== undefined) {
        const resolvedDefaultValue = await resolveDefault(db, cfgDefault)
        return { ...field, defaultValue: resolvedDefaultValue }
      }
      return field
    }),
  )

  return { ...formSpec, fields }
}
