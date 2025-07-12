import type { SQL, Table } from 'drizzle-orm'
import { getListColumns, zodToListSpec } from '#layers/autoadmin/utils/list'
import { getTableForeignKeysByColumn } from '#layers/autoadmin/utils/relation.js'
import { count, eq, getTableColumns, like, or } from 'drizzle-orm'
import { getModelConfig } from './autoadmin'

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
  const cfg = getModelConfig(modelLabel)
  const model = cfg.model

  const tableColumns = cfg.columns
  const metadata = cfg.metadata
  const columnTypes = zodToListSpec(cfg.create.schema as any)
  const { columns, toJoin } = getListColumns(cfg, tableColumns, columnTypes, metadata)

  const spec = {
    endpoint: cfg.list.endpoint,
    updatePage: cfg.update.enabled ? cfg.update.route : undefined,
    deleteEndpoint: cfg.delete.enabled ? cfg.delete.endpoint : undefined,
    title: cfg.list.title,
    enableSearch: cfg.list.enableSearch,
    searchPlaceholder: cfg.list.searchPlaceholder,
    searchFields: cfg.list.searchFields,
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
    const foreignTableColumns = getTableColumns(foreignTable)

    // Create a unique key for this join based on the foreign key column
    const joinKey = `${fk}_${relation.foreignColumn.name}`

    // Only add join if we haven't already added it for this foreign key
    if (!addedJoins.has(joinKey)) {
      joins.push({
        table: foreignTable,
        on: eq(tableColumns[fk], foreignTableColumns[relation.foreignColumn.name]),
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
    const allColumns = { ...tableColumns, ...foreignColumnSelections }
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

  // Handle search query
  const searchQuery = query.search
  const searchFields = cfg.list?.searchFields || []
  let searchCondition: SQL | undefined
  if (searchQuery && searchFields.length > 0) {
    const searchConditions = []

    // Handle search fields (both direct fields and foreign key fields)
    for (const field of searchFields) {
      if (field in tableColumns) {
        // Direct column search
        searchConditions.push(like(tableColumns[field], `%${searchQuery}%`))
      } else if (field.includes('.')) {
        // Foreign key field search (e.g., preferredLocationId.name)
        const [fk, foreignColumnName] = field.split('.')
        if (fk in tableColumns) {
          const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
          if (foreignKeys.length > 0) {
            const foreignKey = foreignKeys[0]
            const foreignTable = foreignKey.foreignTable
            const foreignTableColumns = getTableColumns(foreignTable)

            if (foreignColumnName in foreignTableColumns) {
              // Ensure this foreign table is joined
              const joinKey = `${fk}_${foreignKey.foreignColumn.name}`
              if (!addedJoins.has(joinKey)) {
                joins.push({
                  table: foreignTable,
                  on: eq(tableColumns[fk], foreignTableColumns[foreignKey.foreignColumn.name]),
                })
                addedJoins.add(joinKey)
              }

              // Add search condition for foreign column
              searchConditions.push(like(foreignTableColumns[foreignColumnName], `%${searchQuery}%`))
            }
          }
        }
      }
    }

    if (searchConditions.length > 0) {
      searchCondition = or(...searchConditions)
    }
  }
  // Apply search condition to base query
  if (searchCondition) {
    baseQuery = baseQuery.where(searchCondition)
  }

  // Build count query with search condition
  let countQuery = db.select({ resultCount: count() }).from(model)
  for (const join of joins) {
    countQuery = countQuery.leftJoin(join.table, join.on)
  }
  if (searchCondition) {
    countQuery = countQuery.where(searchCondition)
  }

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
