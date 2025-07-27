import type { AdminModelConfig, FilterFieldDef } from '#layers/autoadmin/composables/registry'
import type { SQL, Table } from 'drizzle-orm'
import type { DbType } from './db'
import type { zodToListSpec } from './list'
import type { TableMetadata } from './metdata'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { eq, sql } from 'drizzle-orm'
import { getLabelColumnFromModel } from './autoadmin'
import { getTableForeignKeysByColumn } from './relation'

export type FilterType = 'boolean' | 'text' | 'date' | 'daterange' | 'relation'
type ColTypes = ReturnType<typeof zodToListSpec>
export type FilterSpec = Awaited<ReturnType<typeof prepareFilter>>

export interface CustomFilter {
  parameterName: string
  label: string
  type?: FilterType
  // options is optional because it is not required for all types like boolean, date, daterange
  options?: (db: DbType, query: Record<string, any>) => Promise<{ label?: string, value: string }[] | string[]>
  queryConditions: (db: DbType, value: any) => Promise<SQL[]>
}

async function prepareCustomFilter(cfg: AdminModelConfig, db: DbType, columnTypes: ColTypes, filter: CustomFilter, query: Record<string, any>) {
  return {
    field: filter.parameterName,
    label: filter.label,
    type: filter.type || 'text',
    options: filter.options ? await filter.options(db, query) : undefined,
    queryConditions: filter.queryConditions,
  }
}

async function prepareFilter(cfg: AdminModelConfig, db: DbType, columnTypes: ColTypes, field: string, label?: string, definedType?: string, query: Record<string, any> = {}) {
  const type = definedType || columnTypes[field]?.type
  if (type === 'boolean') {
    return {
      field,
      label: label || toTitleCase(field),
      type: 'boolean',
    }
  } else if (type === 'date' || type === 'daterange') {
    return {
      field,
      label: label || toTitleCase(field),
      type: definedType || 'daterange', // uses `daterange` for computed `date` type unless type specifically defined as `date`
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
    const options = columnTypes[field]?.options || []
    return {
      field,
      label: label || toTitleCase(field),
      type: 'text',
      options,
    }
  } else if (type === 'number') {
    return {
      field,
      label: label || toTitleCase(field),
      type: 'text',
    }
  } else if (type === 'relation') {
    const relations = getTableForeignKeysByColumn(cfg.model, field)
    if (relations.length === 0) {
      throw new Error(`Invalid relation: ${JSON.stringify(field)}`)
    }
    const relation = relations[0]!
    let options
    if (query[field]) {
      const rows = await db.select().from(relation.foreignTable).where(eq(relation.foreignColumn, query[field]))
      options = rows.map(row => ({
        label: row[getLabelColumnFromModel(relation.foreignTable)],
        value: row[relation.foreignColumn.name],
      }))
    }
    return {
      field,
      label: label || toTitleCase(field).replace(/ Id/g, ''),
      type: 'relation',
      choicesEndpoint: `${cfg.apiPrefix}/formspec/${cfg.label}/choices/${relation.columnName}`,
      options,
    }
  }

  throw new Error(`Invalid filter: ${JSON.stringify(field)}`)
}

async function prepareFilters(cfg: AdminModelConfig, db: DbType, filters: FilterFieldDef<Table>[], columnTypes: ColTypes, metadata: TableMetadata, query: Record<string, any>) {
  const parsedFilters = await Promise.all(filters.map(async (filter) => {
    if (typeof filter === 'string') {
      return await prepareFilter(cfg, db, columnTypes, filter)
    } else if (typeof filter === 'object') {
      if ('parameterName' in filter && 'label' in filter) {
        return await prepareCustomFilter(cfg, db, columnTypes, filter as unknown as CustomFilter, query)
      }
      return await prepareFilter(cfg, db, columnTypes, filter.field, filter.label, filter.type, query)
    }
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

export async function getFilters(cfg: AdminModelConfig, db: DbType, columnTypes: ColTypes, metadata: TableMetadata, query: Record<string, any>) {
  const filters = cfg.list?.filterFields
  if (filters) {
    return await prepareFilters(cfg, db, filters, columnTypes, metadata, query)
  }
  // get boolean, enum, date
  const booleanColumnNames = Object.keys(columnTypes).filter(column => columnTypes[column]?.type === 'boolean')
  const enumColumnNames = Object.keys(columnTypes).filter(column => columnTypes[column]?.type === 'select')
  const dateColumnNames = Object.keys(columnTypes).filter(column => columnTypes[column]?.type === 'date')
  const defaultFilterColumns = [...booleanColumnNames, ...enumColumnNames, ...dateColumnNames]
  return prepareFilters(cfg, db, defaultFilterColumns, columnTypes, metadata, {})
}
