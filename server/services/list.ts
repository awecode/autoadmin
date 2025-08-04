import type { AdminModelConfig } from '#layers/autoadmin/composables/registry'
import type { SQL, Table } from 'drizzle-orm'
import { aggregateFunctions } from '#layers/autoadmin/composables/registry'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { asc, count, desc, eq, getTableColumns, like, or, sql } from 'drizzle-orm'
import { createDateFilterCondition, createDateRangeFilterCondition } from '../utils/dateFilter'
import { colKey, getPaginatedResults } from '../utils/drizzle'
import { getFilters } from '../utils/filter'
import { getListColumns, zodToListSpec } from '../utils/list'
import { getPrimaryKeyColumn, getTableForeignKeysByColumn } from '../utils/relation'

export async function listRecords<T extends Table>(cfg: AdminModelConfig<T>, query: Record<string, any> = {}): Promise<any> {
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
    enableDelete: cfg.delete.enabled,
    bulkActions: cfg.list.bulkActions.map(action => ({
      label: action.label,
      icon: action.icon,
    })),
    title: cfg.list.title,
    showCreateButton: cfg.create.enabled && cfg.list.showCreateButton,
    enableSort: cfg.list.enableSort,
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
    if (!fk || !foreignColumnName) {
      throw new Error(`Invalid field definition: ${JSON.stringify(field)}`)
    }
    const foreignTable = relation.foreignTable

    // Get table columns to access them properly
    const foreignTableColumns = getTableColumns(foreignTable)

    // Create a unique key for this join based on the foreign key column
    const joinKey = `${fk}_${colKey(relation.foreignColumn)}`

    // Only add join if we haven't already added it for this foreign key
    if (!addedJoins.has(joinKey) && fk in tableColumns) {
      joins.push({
        table: foreignTable,
        on: eq(tableColumns[fk]!, foreignTableColumns[colKey(relation.foreignColumn)]),
      })
      addedJoins.add(joinKey)
    }

    // Add foreign column to selection with alias
    const accessorKey = `${fk}__${foreignColumnName}`
    if (foreignTableColumns[foreignColumnName]) {
      foreignColumnSelections[accessorKey] = foreignTableColumns[foreignColumnName]
    }
  }

  let selections = foreignColumnSelections
  let aggregates: { key: string, label: string }[] = []
  if (cfg.list.customSelections) {
    const customSelections = Object.fromEntries(
      Object.entries(cfg.list.customSelections).map(([key, value]) => [
        key,
        value.sql,
      ]),
    )
    aggregates = Object.entries(cfg.list.customSelections).filter(([_key, value]) => value.isAggregate).map(([key, value]) => ({
      key,
      label: value.label ?? toTitleCase(key),
    }))
    selections = { ...selections, ...customSelections }
  }

  if (cfg.list.aggregates) {
    const customAggregates = Object.fromEntries(
      Object.entries(cfg.list.aggregates).map(([key, value]) => {
        let colName: string
        if (typeof value.column === 'string') {
          colName = value.column
          // column = tableColumns[value.column]
          // if (!column) {
          //   throw new Error(`Invalid aggregate column: ${value.column}`)
          // }
        } else {
          colName = value.column.name
        }
        if (!value.function) {
          throw new Error(`Aggregate function is required for ${key}`)
        }
        if (!aggregateFunctions.includes(value.function)) {
          throw new Error('Invalid function')
        }
        let sqlExpression: SQL<number>
        // This breaks for snake case in db, camelCase in drizzle without name specified
        // column.name returns camelCase but we need snake case for raw sql
        // https://github.com/drizzle-team/drizzle-orm/issues/3094
        if (value.function === 'count') {
          sqlExpression = sql<number>`${sql.raw(`sum(CASE WHEN ${colName} THEN 1 ELSE 0 END) OVER () AS ${key}`)
          }`
        } else {
          sqlExpression = sql<number>`${sql.raw(`${value.function}(${colName}) OVER () AS ${key}`)
          }`
        }
        return [key, sqlExpression]
      }),
    )
    selections = { ...selections, ...customAggregates }
    aggregates.push(...Object.entries(cfg.list.aggregates).map(([key, value]) => {
      return {
        key,
        label: value.label ?? toTitleCase(key),
      }
    }))
  }

  let baseQuery
  // We need to select all columns from the table if we have accessor functions because the accessor functions may need to access other columns
  const shouldSelectAllColumns = spec.columns.some(column => column.accessorFn)
  if (shouldSelectAllColumns) {
    selections = { ...tableColumns, ...selections }
    baseQuery = db.select(selections).from(model)
  } else {
    const columnNames = spec.columns.map(column => column.accessorKey)
    // only select the required column names from the table, not all columns
    const columnselections = Object.fromEntries(
      columnNames
        .filter(key => key in tableColumns)
        .map(key => [key, tableColumns[key]!]),
    )
    // add lookup column to the selected columns if it does not exist
    if (!(cfg.lookupColumnName in selections)) {
      selections[cfg.lookupColumnName] = tableColumns[cfg.lookupColumnName]!
    }
    selections = { ...selections, ...columnselections }
    baseQuery = db.select(selections).from(model)
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
        searchConditions.push(like(tableColumns[field]!, `%${searchQuery}%`))
      } else if (field.includes('.')) {
        // Foreign key field search (e.g., preferredLocationId.name)
        const [fk, foreignColumnName] = field.split('.')
        if (fk && foreignColumnName && fk in tableColumns) {
          const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
          if (foreignKeys.length > 0) {
            const foreignKey = foreignKeys[0]!
            const foreignTable = foreignKey.foreignTable
            const foreignTableColumns = getTableColumns(foreignTable)

            if (foreignColumnName in foreignTableColumns) {
              // Ensure this foreign table is joined
              const joinKey = `${fk}_${colKey(foreignKey.foreignColumn)}`
              if (!addedJoins.has(joinKey)) {
                joins.push({
                  table: foreignTable,
                  on: eq(tableColumns[fk]!, foreignTableColumns[colKey(foreignKey.foreignColumn)]),
                })
                addedJoins.add(joinKey)
              }

              // Add search condition for foreign column
              searchConditions.push(like(foreignTableColumns[foreignColumnName]!, `%${searchQuery}%`))
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
          if (filter.type === 'boolean') {
            const boolValue = filterValue === 'true' || filterValue === true
            const conditions = await filter.queryConditions(db, boolValue)
            filterConditions.push(...conditions)
          } else {
            const conditions = await filter.queryConditions(db, filterValue)
            filterConditions.push(...conditions)
          }
        } else {
          const column = tableColumns[filter.field]
          if (!column) {
            throw new Error(`Invalid filter field: ${filter.field}`)
          }
          if (filter.type === 'boolean') {
            // Handle boolean filters
            const boolValue = filterValue === 'true' || filterValue === true
            filterConditions.push(eq(column, boolValue))
          } else if (filter.type === 'daterange') {
            const condition = createDateRangeFilterCondition(
              column,
              filterValue,
              'originalType' in filter && filter.originalType === 'datetime-local',
            )
            if (condition) {
              filterConditions.push(condition)
            }
          } else if (filter.type === 'date') {
            const condition = createDateFilterCondition(
              column,
              filterValue,
              'originalType' in filter && filter.originalType === 'datetime-local',
            )
            if (condition) {
              filterConditions.push(condition)
            }
          } else if (filter.type === 'text' || filter.type === 'relation' || filter.type === 'select') {
            filterConditions.push(eq(column, filterValue))
          }
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
  if (spec.enableSort && ordering && typeof ordering === 'string') {
    const [columnAccessorKey, direction] = ordering.split(':')
    const column = spec.columns.find(column => column.accessorKey === columnAccessorKey)

    if (column?.sortKey && (direction === 'asc' || direction === 'desc')) {
      const orderFn = direction === 'desc' ? desc : asc

      // Check if sortKey is a foreign key relation (contains dot)
      if (column.sortKey.includes('.')) {
        const [fk, foreignColumnName] = column.sortKey.split('.')

        if (!fk || !foreignColumnName) {
          throw new Error(`Invalid ordering field: ${JSON.stringify(column.sortKey)}`)
        }

        // Get foreign key relations for this column
        const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
        if (foreignKeys.length > 0) {
          const foreignKey = foreignKeys[0]!
          const foreignTable = foreignKey.foreignTable
          const foreignTableColumns = getTableColumns(foreignTable)

          // Ensure the foreign table is joined
          const joinKey = `${fk}_${colKey(foreignKey.foreignColumn)}`
          if (!addedJoins.has(joinKey) && fk in tableColumns) {
            baseQuery = baseQuery.leftJoin(foreignTable, eq(tableColumns[fk]!, foreignTableColumns[colKey(foreignKey.foreignColumn)]))
          }

          // Apply ordering on foreign column
          if (foreignColumnName in foreignTableColumns) {
            baseQuery = baseQuery.orderBy(orderFn(foreignTableColumns[foreignColumnName]!))
          }
        }
      } else {
        // Direct column sorting
        if (column.sortKey in tableColumns) {
          baseQuery = baseQuery.orderBy(orderFn(tableColumns[column.sortKey]!))
        }
      }
    }
  } else {
    // default ordering by primary key descending
    const primaryKeyColumn = getPrimaryKeyColumn(model)
    baseQuery = baseQuery.orderBy(desc(primaryKeyColumn))
  }

  // Build count query with combined conditions
  let countQuery = db.select({ resultCount: count() }).from(model) as any
  for (const join of joins) {
    countQuery = countQuery.leftJoin(join.table, join.on)
  }
  if (combinedConditions) {
    countQuery = countQuery.where(combinedConditions)
  }

  const response = await getPaginatedResults<typeof model>(baseQuery, countQuery, query)

  if (aggregates.length > 0 && response.results.length > 0) {
    response.aggregates = response.results.reduce((acc: Record<string, any>, result: any) => {
      aggregates.forEach((aggregate) => {
        acc[aggregate.key] = {
          label: aggregate.label,
          value: result[aggregate.key],
        }
      })
      return acc
    }, {})

    // Remove aggregate columns from response results, if shouldSelectAllColumns is true, it will be handled in the next step
    if (!shouldSelectAllColumns) {
      response.results = response.results.map((result: any) => {
        return Object.fromEntries(
          Object.entries(result).filter(([key]) => !aggregates.some(aggregate => aggregate.key === key)),
        )
      })
    }
  }

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
    response.results = response.results.map((result) => {
      return Object.fromEntries(
        Object.entries(result).filter(([key]) => spec.columns.some(column => column.accessorKey === key) || key === cfg.lookupColumnName),
      )
    })
  }
  return {
    ...response,
    filters,
    spec,
  }
}
