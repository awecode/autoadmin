import type { AnyColumn, Column, SQL, Table } from 'drizzle-orm'
import type { RuntimeConfig } from 'nuxt/schema'
import type { DatabaseDialect } from '../../utils/databaseDialect'
import process from 'node:process'
import { getTableColumns, ilike, like, sql } from 'drizzle-orm'
import { getTableConfig as getPgTableConfig, alias as pgAlias } from 'drizzle-orm/pg-core'
import { getTableConfig as getSqliteTableConfig, alias as sqliteAlias } from 'drizzle-orm/sqlite-core'
import { getDialectFromUrl } from '../../utils/databaseDialect'

interface SupportedTableConfig {
  foreignKeys?: Array<{ reference: () => { columns: AnyColumn[], foreignColumns: AnyColumn[] } }>
}

export function getConfiguredAdminDialect(config: RuntimeConfig): DatabaseDialect {
  const globalEnv = globalThis as typeof globalThis & { __env__?: { DB?: unknown }, DB?: unknown }
  const dbBinding = process.env.DB || globalEnv.__env__?.DB || globalEnv.DB
  if (dbBinding) {
    return 'sqlite'
  }

  const explicitDialect = config.databaseDialect === 'sqlite' || config.databaseDialect === 'postgresql'
    ? config.databaseDialect
    : undefined
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

/**
 * Alias a related table for LEFT JOIN. Required for self-referential FKs and
 * when multiple FKs target the same table (Drizzle rejects duplicate table refs).
 */
export function aliasRelationTable(table: Table, aliasName: string): Table {
  const safeAlias = aliasName.replace(/\W/g, '_') || 'rel'
  const dialect = getTableDialect(table) ?? 'sqlite'
  if (dialect === 'postgresql') {
    return pgAlias(table as never, safeAlias) as unknown as Table
  }
  return sqliteAlias(table as never, safeAlias) as unknown as Table
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
      config?.autoIncrement === true // For SQLite
      || /Serial|Identity/.test(column.columnType) // For PostgreSQL - type is PgSerial
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
  const pattern = `%${value}%`
  if (getColumnDialect(column) === 'postgresql') {
    if ((column as Column).dataType === 'string') {
      return ilike(column, pattern)
    }
    return sql`${column}::text ILIKE ${pattern}`
  }
  return like(column, pattern)
}

export function buildAggregateExpression(
  fn: string,
  colName: string,
  key: string,
): SQL<number> {
  const q = `"${colName}"`
  const qk = `"${key}"`
  if (fn === 'count') {
    return sql<number>`${sql.raw(
      `CAST(SUM(CASE WHEN ${q} IS NOT NULL AND CAST(${q} AS TEXT) NOT IN ('', '0', 'false') THEN 1 ELSE 0 END) OVER () AS INTEGER) AS ${qk}`,
    )}`
  }
  if (['avg', 'sum', 'min', 'max'].includes(fn)) {
    return sql<number>`${sql.raw(`CAST(${fn}(${q}) OVER () AS REAL) AS ${qk}`)}`
  }
  throw new Error(`Invalid aggregate function: ${fn}`)
}
