import type { SQL, Table } from 'drizzle-orm'
import { useDb } from '#layers/autoadmin/server/utils/db'
import { createDateFilterCondition, createDateRangeFilterCondition } from '#layers/autoadmin/utils/dateFilter'
import { getFilters } from '#layers/autoadmin/utils/filter'
import { getListColumns, zodToListSpec } from '#layers/autoadmin/utils/list'
import { getTableForeignKeysByColumn } from '#layers/autoadmin/utils/relation'
import { asc, count, desc, eq, getTableColumns, like, or, sql } from 'drizzle-orm'
import { getModelConfig } from './autoadmin'

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
  const cfg = getModelConfig(modelLabel)
  const model = cfg.model
  const tableColumns = cfg.columns
  // TODO Maybe move the following two lines to registry, have it computed once instead of on each ssr
  const columnTypes = zodToListSpec(cfg.create.schema as any)
  const { columns, toJoin } = getListColumns(cfg, tableColumns, columnTypes, cfg.metadata)
  const db = useDb()
  const filters = cfg.list.enableFilter ? await getFilters(cfg, db, columnTypes, cfg.metadata, query) : undefined

  const spec = {
    endpoint: cfg.list.endpoint,
    updatePage: cfg.update.enabled ? cfg.update.route : undefined,
    deleteEndpoint: cfg.delete.enabled ? cfg.delete.endpoint : undefined,
    title: cfg.list.title,
    enableSearch: cfg.list.enableSearch,
    searchPlaceholder: cfg.list.enableSearch ? cfg.list.searchPlaceholder : undefined,
    searchFields: cfg.list.enableSearch ? cfg.list.searchFields : undefined,
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



  // Handle search query
  const searchQuery = query.search
  const searchFields = cfg.list?.searchFields || []
  let searchCondition: SQL | undefined
  if (cfg.list.enableSearch && searchQuery && searchFields.length > 0) {
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
  // Handle filter conditions
  const filterConditions: SQL[] = []
  if (cfg.list.enableFilter && filters && filters.length > 0) {
    for (const filter of filters) {
      // Skip if filter is a string (shouldn't happen after prepareFilters, but type safety)
      if (typeof filter === 'string') continue

      const filterValue = query[filter.field]
      if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
        if ('queryConditions' in filter) {
          const conditions = await filter.queryConditions(db, filterValue)
          filterConditions.push(...conditions)
        } else if (filter.type === 'boolean') {
          // Handle boolean filters
          const boolValue = filterValue === 'true' || filterValue === true
          filterConditions.push(eq(tableColumns[filter.field], boolValue))
        } else if (filter.type === 'daterange') {
          const condition = createDateRangeFilterCondition(
            tableColumns[filter.field],
            filterValue,
            'originalType' in filter && filter.originalType === 'datetime-local',
          )
          if (condition) {
            filterConditions.push(condition)
          }
        } else if (filter.type === 'date') {
          const condition = createDateFilterCondition(
            tableColumns[filter.field],
            filterValue,
            'originalType' in filter && filter.originalType === 'datetime-local',
          )
          if (condition) {
            filterConditions.push(condition)
          }
        } else if (filter.type === 'text' || filter.type === 'relation') {
          filterConditions.push(eq(tableColumns[filter.field], filterValue))
        }
      }
    }
  }

  // Combine search and filter conditions
  let combinedConditions: SQL | undefined
  if (searchCondition && filterConditions.length > 0) {
    combinedConditions = sql`${searchCondition} AND ${sql.join(filterConditions, sql` AND `)}`
  } else if (searchCondition) {
    combinedConditions = searchCondition
  } else if (filterConditions.length > 0) {
    combinedConditions = sql.join(filterConditions, sql` AND `)
  }
  // Add joins to the query and prepare ordering
  for (const join of joins) {
    baseQuery = baseQuery.leftJoin(join.table, join.on)
  }

  // Apply combined conditions to base query
  if (combinedConditions) {
    baseQuery = baseQuery.where(combinedConditions)
  }

  // Handle ordering (after joins are applied)
  const ordering = query.ordering
  if (ordering && typeof ordering === 'string') {
    const [columnAccessorKey, direction] = ordering.split(':')
    const column = spec.columns.find(column => column.accessorKey === columnAccessorKey)

    if (column?.sortKey && (direction === 'asc' || direction === 'desc')) {
      const orderFn = direction === 'desc' ? desc : asc

      // Check if sortKey is a foreign key relation (contains dot)
      if (column.sortKey.includes('.')) {
        const [fk, foreignColumnName] = column.sortKey.split('.')

        // Get foreign key relations for this column
        const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
        if (foreignKeys.length > 0) {
          const foreignKey = foreignKeys[0]
          const foreignTable = foreignKey.foreignTable
          const foreignTableColumns = getTableColumns(foreignTable)

          // Ensure the foreign table is joined
          const joinKey = `${fk}_${foreignKey.foreignColumn.name}`
          if (!addedJoins.has(joinKey)) {
            baseQuery = baseQuery.leftJoin(foreignTable, eq(tableColumns[fk], foreignTableColumns[foreignKey.foreignColumn.name]))
          }

          // Apply ordering on foreign column
          if (foreignColumnName in foreignTableColumns) {
            baseQuery = baseQuery.orderBy(orderFn(foreignTableColumns[foreignColumnName]))
          }
        }
      } else {
        // Direct column sorting
        if (column.sortKey in tableColumns) {
          baseQuery = baseQuery.orderBy(orderFn(tableColumns[column.sortKey]))
        }
      }
    }
  }

  // Build count query with combined conditions
  let countQuery = db.select({ resultCount: count() }).from(model) as any
  for (const join of joins) {
    countQuery = countQuery.leftJoin(join.table, join.on)
  }
  if (combinedConditions) {
    countQuery = countQuery.where(combinedConditions)
  }

  const response = await getPaginatedResponse<typeof model>(baseQuery, countQuery, query)
  if (shouldSelectAllColumns) {
    // run the columns through the accessor functions
    response.results = response.results.map((result: any) => {
      // loop through the columns and run the accessor functions
      spec.columns.forEach((column) => {
        if (column.accessorFn) {
          result[column.accessorKey] = column.accessorFn(result)
        }
      })
      return result
    })
    // only return the columns that have accessor keys or the lookup column
    response.results = response.results.map((result: any) => {
      return Object.fromEntries(
        Object.entries(result).filter(([key]) => spec.columns.some(column => column.accessorKey === key) || key === cfg.lookupColumnName),
      )
    }) as any
  }
  return {
    ...response,
    filters,
    spec,
  }
}
