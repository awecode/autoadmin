import type { AdminModelConfig, FilterFieldDef } from '#layers/autoadmin/composables/useAdminRegistry'
import type { useDb } from '#layers/autoadmin/server/utils/db'
import type { zodToListSpec } from '#layers/autoadmin/utils/list'
import type { TableMetadata } from '#layers/autoadmin/utils/metdata'
import type { Table } from 'drizzle-orm'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { sql } from 'drizzle-orm'

export type FilterType = 'boolean' | 'text' | 'date' | 'daterange'
type ColTypes = ReturnType<typeof zodToListSpec>
type DbType = ReturnType<typeof useDb>

async function prepareFilter(cfg: AdminModelConfig, db: DbType, columnTypes: ColTypes, field: string, label?: string, definedType?: string) {
  const type = columnTypes[field]?.type
  if (type === 'boolean') {
    return {
      field,
      label: label || toTitleCase(field),
      type: 'boolean',
    }
  } else if (type === 'date') {
    return {
      field,
      label: label || toTitleCase(field),
      type: definedType || 'daterange',
    }
  } else if (type === 'text') {
    const column = cfg.columns[field]
    // TODO Fix for other dialects
    //   const options = await db.all(
    //     sql`SELECT DISTINCT ${column} AS value FROM ${cfg.model}`,
    //   )
    const options = await db.all(
      sql`SELECT ${column} AS value, COUNT(*) AS count FROM ${cfg.model} GROUP BY ${column}`,
    ) as { value: string, count: number }[]
    return {
      field,
      label: label || toTitleCase(field),
      type: 'text',
      options,
    }
  } else if (type === 'select') {
    const options = columnTypes[field].options || []
    return {
      field,
      label: label || toTitleCase(field),
      type: 'text',
      options,
    }
  }
  throw new Error(`Invalid filter: ${JSON.stringify(field)}`)
}

async function prepareFilters(cfg: AdminModelConfig, db: DbType, filters: FilterFieldDef<Table>[], columnTypes: ColTypes, metadata: TableMetadata) {
  const parsedFilters = await Promise.all(filters.map(async (filter) => {
    if (typeof filter === 'string') {
      return await prepareFilter(cfg, db, columnTypes, filter)
    } else if (typeof filter === 'object') {
      return await prepareFilter(cfg, db, columnTypes, filter.field, filter.label, filter.type)
    }
    // TODO Remove this once prepareFilter is used everywhere
    throw new Error(`Invalid filter: ${JSON.stringify(filter)}`)
  }))
  // change column type to datetime-local if it is a datetime column
  const datetimeColumns = metadata.datetimeColumns.concat(metadata.autoTimestampColumns)
  const parsedFiltersWithOriginalType = parsedFilters.map((filter) => {
    if (datetimeColumns.includes(filter.field)) {
      return { ...filter, originalType: 'datetime-local' }
    }
    return filter
  })
  return parsedFiltersWithOriginalType
}

export async function getFilters(cfg: AdminModelConfig, db: DbType, columnTypes: ColTypes, metadata: TableMetadata) {
  const filters = cfg.list?.filterFields
  if (filters) {
    return await prepareFilters(cfg, db, filters, columnTypes, metadata)
  }
  // get boolean, enum, date
  const booleanColumnNames = Object.keys(columnTypes).filter(column => columnTypes[column].type === 'boolean')
  const enumColumnNames = Object.keys(columnTypes).filter(column => columnTypes[column].type === 'select')
  const dateColumnNames = Object.keys(columnTypes).filter(column => columnTypes[column].type === 'date')
  const defaultFilterColumns = [...booleanColumnNames, ...enumColumnNames, ...dateColumnNames]
  return prepareFilters(cfg, db, defaultFilterColumns, columnTypes, metadata)
}
