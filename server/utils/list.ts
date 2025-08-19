import type { AdminModelConfig, ColKey, FieldType, ListColumnDef, ListFieldDef } from '#layers/autoadmin/server/utils/registry'
import type { Column, Table } from 'drizzle-orm'
import type { ZodObject, ZodType } from 'zod'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { createInsertSchema } from 'drizzle-zod'
import { ZodEnum, ZodUnion } from 'zod'
import { colKey } from './drizzle'
import { getTableForeignKeys, getTableForeignKeysByColumn } from './relation'
import { unwrapZodType } from './zod'

type JoinDef = [ReturnType<typeof getTableForeignKeysByColumn>[0], string]

export function zodToListSpec(schema: ZodObject<Record<string, ZodType>>): Record<string, { type: FieldType, options?: string[] }> {
  const shape = schema.shape

  const fields: [string, { type: FieldType, options?: any }][] = Object.entries(shape).map(([name, zodType]) => {
    const { innerType } = unwrapZodType(zodType)

    const definition = innerType.def
    const definitionTypeKey = definition?.type

    let type: FieldType = 'text'
    let options
    switch (definitionTypeKey) {
      case 'string':
        type = 'text'
        break
      case 'number':
        type = 'number'
        break
      case 'boolean':
        type = 'boolean'
        break
      case 'enum':
        type = 'select'
        if (innerType instanceof ZodEnum) {
          options = innerType.options
        }
        break
      case 'date':
        type = 'date'
        break
      case 'bigint':
        type = 'number'
        break
      case 'custom':
        // Drizzle-zod uses a custom type for blobs, which we'll map to 'file'.
        type = 'blob'
        break
      case 'record':
        type = 'json'
        break
      case 'union':
        // If a union contains a record type, it's likely a JSON field from drizzle-zod.
        if (innerType instanceof ZodUnion) {
          if (innerType.options?.some((opt) => {
            return opt._zod.def.type === 'record'
          })) {
            type = 'json'
          }
        }
        break
    }

    return [name, { type, options }]
  })
  return Object.fromEntries(fields)
}

const uniqifyFieldName = (fieldName: string) => {
  if (fieldName === 'field') {
    // anonymous functions get the name `field`, and multiple anonymous functions can have the same name
    return `f_${Math.random().toString(36).substring(2, 15)}`
  }
  return fieldName
}

export function getListColumns<T extends Table>(cfg: AdminModelConfig<T>, tableColumns: Record<ColKey<T>, Column>, columnTypes: Record<string, { type: FieldType, options?: string[] }>, metadata: TableMetadata): { columns: ListColumnDef<T>[], toJoin: JoinDef[] } {
  let columns: ListColumnDef<T>[] = []
  const toJoin: JoinDef[] = []
  if (cfg.list.fields) {
    columns = cfg.list.fields.map((def: ListFieldDef<T>) => {
      if (typeof def === 'string') {
        if (def in tableColumns) {
          return {
            id: def,
            accessorKey: def as string,
            header: toTitleCase(def),
            type: columnTypes[def]!.type,
            sortKey: cfg.list.enableSort ? def : undefined,
          }
        } else if (def.includes('.')) {
          const [fk, foreignColumnName] = def.split('.')
          // TODO Check if fk is a foreign key using getTableForeignKeys
          if (fk && foreignColumnName && fk in tableColumns) {
            const accessorKey = def.replace('.', '__')
            const header = toTitleCase(accessorKey.replace('Id__', ' ').replace('__', ' '))
            const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
            if (foreignKeys.length === 0) {
              throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
            }
            const foreignKey = foreignKeys[0]!
            const foreignTable = foreignKey.foreignTable
            const insertSchema = createInsertSchema(foreignTable)
            const foreignTableListSpec = zodToListSpec(insertSchema as any)
            toJoin.push([foreignKey, def])
            return {
              id: accessorKey,
              accessorKey,
              header,
              type: columnTypes[accessorKey]?.type || foreignTableListSpec[foreignColumnName]?.type,
              sortKey: cfg.list.enableSort ? def : undefined,
            }
          } else {
            throw new Error(`Invalid field definition, no column ${fk} found in ${cfg.key}.`)
          }
        }
        throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
      } else if (typeof def === 'function') {
        const fieldName = uniqifyFieldName(def.name)
        return {
          id: fieldName,
          accessorKey: fieldName,
          header: toTitleCase(fieldName),
          type: columnTypes[fieldName]?.type,
          accessorFn: def,
        }
      } else if (typeof def === 'object') {
        if (typeof def.field === 'string') {
          if (def.field in tableColumns) {
            return {
              id: def.field,
              accessorKey: def.field,
              header: def.label ?? toTitleCase(def.field),
              type: def.type ?? columnTypes[def.field]?.type,
              sortKey: cfg.list.enableSort ? def.sortKey ?? def.field : undefined,
            }
          } else if (def.field.includes('.')) {
            const [fk, foreignColumnName] = def.field.split('.')
            if (fk && foreignColumnName && fk in tableColumns) {
              const accessorKey = def.field.replace('.', '__')
              const header = def.label ?? toTitleCase(accessorKey.replace('Id__', ' ').replace('__', ' '))
              const foreignKeys = getTableForeignKeysByColumn(cfg.model, fk)
              if (foreignKeys.length === 0) {
                throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
              }
              const foreignKey = foreignKeys[0]!
              const foreignTable = foreignKey.foreignTable
              const insertSchema = createInsertSchema(foreignTable)
              const foreignTableListSpec = zodToListSpec(insertSchema as any)
              toJoin.push([foreignKey, def.field])
              return {
                id: accessorKey,
                accessorKey,
                header,
                type: def.type || columnTypes[accessorKey]?.type || foreignTableListSpec[foreignColumnName]?.type,
                sortKey: cfg.list.enableSort ? def.sortKey ?? def.field : undefined,
              }
            }
          } else {
            throw new Error(`Invalid field definition: ${JSON.stringify(def)}`)
          }
        } else if (typeof def.field === 'function') {
          if (def.field.name === 'field' && def.cell) {
            throw new Error('Anonymous functions are not supported for list fields with a cell function.')
          }
          const fieldName = uniqifyFieldName(def.field.name)
          return {
            id: fieldName,
            accessorKey: fieldName,
            header: def.label ?? toTitleCase(fieldName),
            type: def.type ?? columnTypes[fieldName]?.type,
            accessorFn: def.field,
            sortKey: cfg.list.enableSort && def.sortKey ? def.sortKey : undefined,
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
      type: columnTypes[key]?.type,
      sortKey: cfg.list.enableSort ? key as ColKey<T> : undefined,
    }))
    // Remove primary autoincrement and auto timestamp columns
    columns = columns.filter((column) => {
      const columnsToExclude = metadata.primaryAutoincrementColumns.concat(metadata.autoTimestampColumns)
      return !columnsToExclude.includes(column.accessorKey)
    })
    // Also remove foreign keys
    const foreignKeys = getTableForeignKeys(cfg.model)
    columns = columns.filter((column) => {
      return !foreignKeys.some(foreignKey => colKey(foreignKey.column) === column.accessorKey)
    })
  }
  if ((typeof cfg.fields !== 'undefined') && cfg.fields.length > 0) {
    columns = columns.map((column) => {
      if (cfg.fields!.some(field => field.name === column.accessorKey)) {
        return {
          ...column,
          type: cfg.fields!.find(field => field.name === column.accessorKey)?.type ?? column.type,
        }
      }
      return column
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
