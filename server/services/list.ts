import type { AdminModelConfig, ListColumnDef, ListFieldDef } from '#layers/autoadmin/composables/useAdminRegistry'
import type { ListFieldType } from '#layers/autoadmin/utils/list.js'
import type { TableMetadata } from '#layers/autoadmin/utils/metdata'
import type { Column, SQL, Table } from 'drizzle-orm'
import { zodToListSpec } from '#layers/autoadmin/utils/list.js'
import { getTableMetadata } from '#layers/autoadmin/utils/metdata'
import { getTableForeignKeys, getTableForeignKeysByColumn } from '#layers/autoadmin/utils/relation'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { count, eq, getTableColumns } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-zod'
import { getModelConfig } from './autoadmin'

type JoinDef = [ReturnType<typeof getTableForeignKeysByColumn>[0], string]

function getListColumns<T extends Table>(cfg: AdminModelConfig<T>, tableColumns: Record<string, Column>, columnTypes: Record<string, ListFieldType>, metadata: TableMetadata): { columns: ListColumnDef<T>[], toJoin: JoinDef[] } {
  let columns: ListColumnDef<T>[] = []
  const toJoin: JoinDef[] = []
  if (cfg.list?.columns) {
    columns = cfg.list.columns
  } else if (cfg.list?.fields) {
    columns = cfg.list.fields.map((def: ListFieldDef<T>) => {
      if (typeof def === 'string') {
        if (def in tableColumns) {
          return {
            id: def,
            accessorKey: def,
            header: toTitleCase(def),
            type: columnTypes[def],
          }
        } else if (def.includes('.')) {
          const [fk, foreignColumnName] = def.split('.')
          // TODO Check if fk is a foreign key using getTableForeignKeys
          if (fk in tableColumns) {
            const accessorKey = def.replace('.', '__')
            const header = toTitleCase(accessorKey.replace('Id__', ' ').replace('__', ' '))
            const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
            if (foreignKeys.length === 0) {
              throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
            }
            const foreignKey = foreignKeys[0]
            const foreignTable = foreignKey.foreignTable
            const insertSchema = createInsertSchema(foreignTable)
            const foreignTableListSpec = zodToListSpec(insertSchema as any)
            toJoin.push([foreignKey, def])
            return {
              id: accessorKey,
              accessorKey,
              header,
              type: columnTypes[accessorKey] || foreignTableListSpec[foreignColumnName],
            }
          } else {
            throw new Error(`Invalid field definition, no column ${fk} found in ${cfg.label}.`)
          }
        }
        throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
      } else if (typeof def === 'function') {
        return {
          id: def.name,
          accessorKey: def.name,
          header: toTitleCase(def.name),
          type: columnTypes[def.name],
          accessorFn: def,
        }
      } else if (typeof def === 'object') {
        if (typeof def.field === 'string') {
          if (def.field in tableColumns) {
            return {
              id: def.field,
              accessorKey: def.field,
              header: def.label ?? toTitleCase(def.field),
              type: def.type ?? columnTypes[def.field],
            }
          } else if (def.field.includes('.')) {
            const [fk, foreignColumnName] = def.field.split('.')
            if (fk in tableColumns) {
              const accessorKey = def.field.replace('.', '__')
              const header = toTitleCase(accessorKey.replace('Id__', ' ').replace('__', ' '))
              const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
              if (foreignKeys.length === 0) {
                throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
              }
              const foreignKey = foreignKeys[0]
              const foreignTable = foreignKey.foreignTable
              const insertSchema = createInsertSchema(foreignTable)
              const foreignTableListSpec = zodToListSpec(insertSchema as any)
              toJoin.push([foreignKey, def.field])
              return {
                id: accessorKey,
                accessorKey,
                header,
                type: def.type || columnTypes[accessorKey] || foreignTableListSpec[foreignColumnName],
              }
            }
          } else {
            throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
          }
        } else if (typeof def.field === 'function') {
          return {
            id: def.field.name,
            accessorKey: def.field.name,
            header: def.label ?? toTitleCase(def.field.name),
            type: def.type ?? columnTypes[def.field.name],
            accessorFn: def.field,
          }
        }
        throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
      }
      throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
    })
  } else {
    columns = Object.keys(tableColumns).map(key => ({
      id: key,
      accessorKey: key,
      header: toTitleCase(key),
      type: columnTypes[key],
    }))
    // Remove primary autoincrement and auto timestamp columns
    columns = columns.filter((column) => {
      const columnsToExclude = metadata.primaryAutoincrementColumns.concat(metadata.autoTimestampColumns)
      return !columnsToExclude.includes(column.accessorKey)
    })
    // Also remove foreign keys
    const foreignKeys = getTableForeignKeys(cfg.model)
    columns = columns.filter((column) => {
      return !foreignKeys.some(foreignKey => foreignKey.column.name === column.accessorKey)
    })
  }
  // change column type to datetime-local if it is a datetime column
  const datetimeColumns = metadata.datetimeColumns.concat(metadata.autoTimestampColumns)
  columns = columns.map((column) => {
    if (datetimeColumns.includes(column.accessorKey)) {
      return { ...column, type: 'datetime-local' }
    }
    return column
  })
  return { columns, toJoin }
}

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
  const cfg = getModelConfig(modelLabel)
  const model = cfg.model
  const config = useRuntimeConfig()

  const tableColumns = getTableColumns(model)
  const columnTypes = zodToListSpec(cfg.create?.schema as any)
  const metadata = getTableMetadata(model)
  const { columns, toJoin } = getListColumns(cfg, tableColumns, columnTypes, metadata)

  const apiPrefix = config.public.apiPrefix
  const spec = {
    endpoint: cfg.list?.endpoint ?? `${apiPrefix}/${modelLabel}`,
    updatePage: cfg.update?.enabled ? { name: 'autoadmin-update', params: { modelLabel: `${modelLabel}` } } : undefined,
    deleteEndpoint: cfg.delete?.enabled ? (cfg.delete?.endpoint ?? `${apiPrefix}/${modelLabel}`) : undefined,
    title: cfg.list?.title ?? toTitleCase(cfg.label ?? modelLabel),
    enableSearch: cfg.list?.enableSearch,
    searchPlaceholder: cfg.list?.searchPlaceholder,
    columns,
    lookupColumnName: cfg.lookupColumnName,
  }

  // Build joins and foreign column selections
  const joins: { table: Table, on: SQL }[] = []
  const foreignColumnSelections: Record<string, any> = {}
  const addedJoins = new Set<string>() // Track which foreign keys have already been joined

  for (const [relation, field] of toJoin) {
    const [fk, foreignColumnName] = field.split('.')
    const foreignTable = relation.foreignTable

    // Get table columns to access them properly
    const modelColumns = getTableColumns(model)
    const foreignTableColumns = getTableColumns(foreignTable)

    // Create a unique key for this join based on the foreign key column
    const joinKey = `${fk}_${relation.foreignColumn.name}`

    // Only add join if we haven't already added it for this foreign key
    if (!addedJoins.has(joinKey)) {
      joins.push({
        table: foreignTable,
        on: eq(modelColumns[fk], foreignTableColumns[relation.foreignColumn.name]),
      })
      addedJoins.add(joinKey)
    }

    // Add foreign column to selection with alias
    const accessorKey = `${fk}__${foreignColumnName}`
    if (foreignTableColumns[foreignColumnName]) {
      foreignColumnSelections[accessorKey] = foreignTableColumns[foreignColumnName]
    }
  }

  let baseQuery
  const db = useDb()
  // We need to select all columns from the table if we have accessor functions because the accessor functions may need to access other columns
  const shouldSelectAllColumns = spec.columns.some(column => column.accessorFn)
  if (shouldSelectAllColumns) {
    const allColumns = { ...getTableColumns(model), ...foreignColumnSelections }
    baseQuery = db.select(allColumns).from(model)
  } else {
    const columnNames = spec.columns.map(column => column.accessorKey as keyof typeof model)
    // only select the required column names from the table, not all columns
    const selectedColumns = Object.fromEntries(
      columnNames
        .filter(key => key in tableColumns)
        .map(key => [key, tableColumns[key]]),
    )
    // add lookup column to the selected columns if it does not exist
    if (!(cfg.lookupColumnName in selectedColumns)) {
      selectedColumns[cfg.lookupColumnName] = tableColumns[cfg.lookupColumnName]
    }
    // add foreign column selections
    Object.assign(selectedColumns, foreignColumnSelections)
    baseQuery = db.select(selectedColumns).from(model)
  }

  // Add joins to the query
  for (const join of joins) {
    baseQuery = baseQuery.leftJoin(join.table, join.on)
  }
  const countQuery = db.select({ resultCount: count() }).from(model)

  const response = await getPaginatedResponse<typeof model>(baseQuery, countQuery, query)
  if (shouldSelectAllColumns) {
    // run the columns through the accessor functions
    response.results = response.results.map((result) => {
      // loop through the columns and run the accessor functions
      spec.columns.forEach((column) => {
        if (column.accessorFn) {
          result[column.accessorKey] = column.accessorFn(result)
        }
      })
      return result
    })
    // only return the columns that have accessor keys or the lookup column
    response.results = response.results.map((result) => {
      return Object.fromEntries(
        Object.entries(result).filter(([key]) => spec.columns.some(column => column.accessorKey === key) || key === cfg.lookupColumnName),
      )
    })
  }
  return {
    ...response,
    spec,
  }
}
