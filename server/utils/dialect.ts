import type { AnyColumn, Column, SQL, Table } from 'drizzle-orm'
import process from 'node:process'
import { getTableColumns, ilike, like, sql } from 'drizzle-orm'
import { getTableConfig as getPgTableConfig } from 'drizzle-orm/pg-core'
import { getTableConfig as getSqliteTableConfig } from 'drizzle-orm/sqlite-core'

export type AdminDialect = 'sqlite' | 'postgres'

const SQLITE_URL_PREFIXES = ['file:', 'libsql:', 'sqlite:']
const POSTGRES_URL_PREFIXES = ['postgres://', 'postgresql://']

interface SupportedTableConfig {
  foreignKeys?: Array<{ reference: () => { columns: AnyColumn[], foreignColumns: AnyColumn[] } }>
}

export function getAdminDialectFromUrl(url: string): AdminDialect | undefined {
  if (POSTGRES_URL_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return 'postgres'
  }
  if (SQLITE_URL_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return 'sqlite'
  }
}

export function getConfiguredAdminDialect(): AdminDialect {
  const globalEnv = globalThis as typeof globalThis & { __env__?: { DB?: unknown }, DB?: unknown }
  const dbBinding = process.env.DB || globalEnv.__env__?.DB || globalEnv.DB
  if (dbBinding) {
    return 'sqlite'
  }

  const config = useRuntimeConfig()
  const explicitDialect = config.databaseDialect
  if (explicitDialect === 'sqlite' || explicitDialect === 'postgres') {
    return explicitDialect
  }

  if (config.databaseUrl) {
    const inferredDialect = getAdminDialectFromUrl(config.databaseUrl as string)
    if (inferredDialect) {
      return inferredDialect
    }
  }

  return 'sqlite'
}

export function getColumnDialect(column: Pick<Column, 'columnType'>): AdminDialect | undefined {
  if (column.columnType.startsWith('Pg')) {
    return 'postgres'
  }
  if (column.columnType.startsWith('SQLite')) {
    return 'sqlite'
  }
}

export function getTableDialect(table: Table): AdminDialect | undefined {
  const firstColumn = Object.values(getTableColumns(table))[0]
  if (!firstColumn) {
    return undefined
  }
  return getColumnDialect(firstColumn)
}

export function getTableConfigByDialect(table: Table): SupportedTableConfig {
  const dialect = getTableDialect(table)
  if (dialect === 'postgres') {
    return getPgTableConfig(table as never) as SupportedTableConfig
  }
  return getSqliteTableConfig(table as never) as SupportedTableConfig
}

export function isGeneratedPrimaryKey(column: Column) {
  const config = (column as any).config
  return column.primary === true
    && (
      config?.autoIncrement === true
      || typeof config?.generatedIdentityType === 'string'
      || config?.generatedIdentity !== undefined
      || config?.generated?.type === 'identity'
      || /Serial|Identity/.test(column.columnType)
    )
}

export function isDateOnlyColumn(column: Column) {
  return ['PgDate', 'PgDateString'].includes(column.columnType)
}

export function isDateTimeColumn(column: Column) {
  const config = (column as any).config
  if (column.columnType === 'SQLiteTimestamp') {
    return config?.mode === 'timestamp_ms'
  }
  return ['PgTimestamp', 'PgTimestampString'].includes(column.columnType)
}

export function isSQLiteTimestampColumn(column: Column) {
  return column.columnType === 'SQLiteTimestamp'
}

export function getSQLiteTimestampDivisor(column: Column) {
  const config = (column as any).config
  return config?.mode === 'timestamp_ms' ? 1 : 1000
}

export function buildTextSearchCondition(column: AnyColumn, value: string): SQL {
  if (getColumnDialect(column) === 'postgres') {
    return ilike(column, `%${value}%`)
  }
  return like(column, `%${value}%`)
}

export function buildAggregateExpression(
  fn: 'avg' | 'sum' | 'min' | 'max' | 'count',
  column: AnyColumn,
): SQL<number> {
  switch (fn) {
    case 'avg':
      return sql<number>`avg(${column}) OVER ()`
    case 'sum':
      return sql<number>`sum(${column}) OVER ()`
    case 'min':
      return sql<number>`min(${column}) OVER ()`
    case 'max':
      return sql<number>`max(${column}) OVER ()`
    case 'count':
      return sql<number>`sum(case when cast(${column} as text) not in ('', '0', 'false') then 1 else 0 end) OVER ()`
  }
}
