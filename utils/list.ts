import type { AdminModelConfig, ColKey, FieldType, ListColumnDef, ListFieldDef } from '#layers/autoadmin/composables/registry'
import type { Column, Table } from 'drizzle-orm'
import type { ZodObject, ZodTypeAny } from 'zod'
import { getTableForeignKeys, getTableForeignKeysByColumn } from '#layers/autoadmin/utils/relation'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { createInsertSchema } from 'drizzle-zod'
import { getDef, unwrapZodType } from './zod'

type JoinDef = [ReturnType<typeof getTableForeignKeysByColumn>[0], string]

export function zodToListSpec(schema: ZodObject<any>): Record<string, { type: FieldType, options?: string[] }> {
  const shape = getDef(schema)?.shape ?? schema.shape
  if (!shape) {
    // Fallback for safety, though a ZodObject should always have a shape.
    return {}
  }

  const fields: [string, { type: FieldType, options?: string[] }][] = Object.entries(shape).map(([name, zodType]) => {
    const { innerType } = unwrapZodType(zodType as ZodTypeAny)

    const definition = getDef(innerType)
    const definitionTypeKey = definition?.typeName ?? definition?.type

    let type: FieldType = 'text'
    let options: string[] | undefined
    switch (definitionTypeKey) {
      case 'ZodString':
      case 'string':
        type = 'text'
        if (definition.checks) {
          for (const check of definition.checks) {
            if (check.kind === 'email') type = 'email'
          }
        }
        break
      case 'ZodNumber':
      case 'number':
        type = 'number'
        break
      case 'ZodBoolean':
      case 'boolean':
        type = 'boolean'
        break
      case 'ZodEnum':
      case 'enum':
        type = 'select'
        options = definition.values ?? (innerType as any).options ?? Object.keys(definition.entries ?? {})
        break
      case 'ZodDate':
      case 'date':
        type = 'date'
        break
      case 'ZodBigInt':
      case 'bigint':
        type = 'number'
        break
      case 'ZodCustom':
      case 'custom':
        // Drizzle-zod uses a custom type for blobs, which we'll map to 'file'.
        type = 'blob'
        break
      case 'ZodRecord':
      case 'record':
        type = 'json'
        break
      case 'ZodUnion':
      case 'union':
        // If a union contains a record type, it's likely a JSON field from drizzle-zod.
        if (definition.options?.some((opt: any) => {
          const optDef = getDef(opt)
          const optTypeKey = optDef?.typeName ?? optDef?.type
          return optTypeKey === 'ZodRecord' || optTypeKey === 'record'
        })) {
          type = 'json'
        }
        break
    }

    return [name, { type, options }]
  })
  return Object.fromEntries(fields)
}

export function getListColumns<T extends Table>(cfg: AdminModelConfig<T>, tableColumns: Record<string, Column>, columnTypes: Record<string, { type: FieldType, options?: string[] }>, metadata: TableMetadata): { columns: ListColumnDef<T>[], toJoin: JoinDef[] } {
  let columns: ListColumnDef<T>[] = []
  const toJoin: JoinDef[] = []
  if (cfg.list.columns) {
    columns = cfg.list.columns
  } else if (cfg.list.fields) {
    columns = cfg.list.fields.map((def: ListFieldDef<T>) => {
      if (typeof def === 'string') {
        if (def in tableColumns) {
          return {
            id: def,
            accessorKey: def,
            header: toTitleCase(def),
            type: columnTypes[def].type,
            sortKey: cfg.list.enableSort ? def : undefined,
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
              type: columnTypes[accessorKey]?.type || foreignTableListSpec[foreignColumnName]?.type,
              sortKey: cfg.list.enableSort ? def : undefined,
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
          type: columnTypes[def.name]?.type,
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
            if (fk in tableColumns) {
              const accessorKey = def.field.replace('.', '__')
              const header = def.label ?? toTitleCase(accessorKey.replace('Id__', ' ').replace('__', ' '))
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
                type: def.type || columnTypes[accessorKey]?.type || foreignTableListSpec[foreignColumnName]?.type,
                sortKey: cfg.list.enableSort ? def.sortKey ?? def.field : undefined,
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
            type: def.type ?? columnTypes[def.field.name]?.type,
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
      return !foreignKeys.some(foreignKey => foreignKey.column.name === column.accessorKey)
    })
  }
  if (!cfg.list.columns && (typeof cfg.fields !== 'undefined') && cfg.fields.length > 0) {
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
