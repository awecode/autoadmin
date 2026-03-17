import type { AnyColumn, Column, SQL, Table } from 'drizzle-orm'
import type { DatabaseDialect } from '../../utils/databaseDialect'
import process from 'node:process'
import { getTableColumns, ilike, like, sql } from 'drizzle-orm'
import { getTableConfig as getPgTableConfig } from 'drizzle-orm/pg-core'
import { getTableConfig as getSqliteTableConfig } from 'drizzle-orm/sqlite-core'
import { getDialectFromUrl, getExplicitDialect } from '../../utils/databaseDialect'

interface SupportedTableConfig {
  foreignKeys?: Array<{ reference: () => { columns: AnyColumn[], foreignColumns: AnyColumn[] } }>
}

export function getConfiguredAdminDialect(): DatabaseDialect {
  const globalEnv = globalThis as typeof globalThis & { __env__?: { DB?: unknown }, DB?: unknown }
  const dbBinding = process.env.DB || globalEnv.__env__?.DB || globalEnv.DB
  if (dbBinding) {
    return 'sqlite'
  }

  const config = useRuntimeConfig()
  const explicitDialect = getExplicitDialect(config.databaseDialect)
  if (explicitDialect) {
    return explicitDialect
  }

  if (config.databaseUrl) {
    const inferredDialect = getDialectFromUrl(config.databaseUrl as string)
    if (inferredDialect) {
      return inferredDialect
    }
  }

  return 'sqlite'
}

export function getColumnDialect(column: Pick<Column, 'columnType'>): DatabaseDialect | undefined {
  if (column.columnType.startsWith('Pg')) {
    return 'postgresql'
  }
  if (column.columnType.startsWith('SQLite')) {
    return 'sqlite'
  }
}

export function getTableDialect(table: Table): DatabaseDialect | undefined {
  const firstColumn = Object.values(getTableColumns(table))[0]
  if (!firstColumn) {
    return undefined
  }
  return getColumnDialect(firstColumn)
}

export function getTableConfigByDialect(table: Table): SupportedTableConfig {
  const dialect = getTableDialect(table)
  if (dialect === 'postgresql') {
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
  if (getColumnDialect(column) === 'postgresql') {
    return ilike(column, `%${value}%`)
  }
  return like(column, `%${value}%`)
}

export function buildAggregateExpression(
  fn: string,
  colName: string,
  key: string,
): SQL<number> {
  if (fn === 'count') {
    // counts truthy values for the column
    return sql<number>`${sql.raw(
      `CAST(SUM(CASE WHEN ${colName} IS NOT NULL AND CAST(${colName} AS TEXT) NOT IN ('', '0', 'false') THEN 1 ELSE 0 END) OVER () AS INTEGER) AS "${key}"`,
    )}`
  }
  return sql<number>`${sql.raw(`CAST(${fn}(${colName}) OVER () AS REAL) AS "${key}"`)}`
}
