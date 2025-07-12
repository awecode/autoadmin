import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm'
import type { ListFieldType } from '../utils/list'
import type { TableMetadata } from '../utils/metdata'
import { defu } from 'defu'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'
import { getLabelColumnFromModel } from '../utils/registry'

type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

// Represents a column name or relation string
type ColField<T extends Table> = ColKey<T> | `${ColKey<T>}.${string}`
// Represents a simple column name or relation string or a callable function (e.g., 'id', 'preferredLocationId.name', (model: InferSelectModel<T>) => any)
type ListField<T extends Table> = ColField<T> | ((model: InferSelectModel<T>) => any)

export type ListFieldDef<T extends Table>
  = ListField<T>
    | { // Represents a detailed field configuration object
      field: ListField<T> // Can be a column/relation string OR a callable function
      label?: string // Optional: custom display label for the field
      type?: ListFieldType // Optional: type hint (e.g., 'string', 'number', 'boolean', 'date')
    }
export interface ListColumnDef<T extends Table> {
  id?: string
  accessorKey: string
  header?: string
  accessorFn?: (model: InferSelectModel<T>) => any
  type?: ListFieldType
}

// TODO: Make this configurable - maybe global config?
const defaultLookupColumnName = 'id'

type ListOptions<T extends Table = Table> = {
  enabled: boolean
  showCreateButton: boolean
  enableSearch: boolean
  searchPlaceholder?: string
  searchFields: ColField<T>[]
  title?: string
  endpoint?: string
  // Do not allow both fields and columns to be set at the same time
} & (
  | {
    fields: Array<ListFieldDef<T>>
    columns?: never
  }
  | {
    fields?: never
    columns: ListColumnDef<T>[]
  }
)

interface CreateOptions<T extends Table = Table> {
  enabled: boolean // added by staticDefaultOptions
  endpoint?: string
  schema: InferInsertModel<T> // added by generateDefaultOptions
}

interface UpdateOptions<T extends Table = Table> {
  enabled: boolean // added by staticDefaultOptions
  endpoint?: string
  showDeleteButton: boolean
  route?: {
    name: string
    params: {
      modelLabel: string
    }
  }
  schema: InferInsertModel<T> // added by generateDefaultOptions
}

interface DeleteOptions {
  enabled: boolean // added by staticDefaultOptions
  endpoint?: string
}

export interface AdminModelOptions<T extends Table = Table> {
  label?: string
  labelColumn?: ColKey<T>
  lookupColumnName?: ColKey<T>
  // searchFields?: ColKey<T>[]
  list?: Partial<ListOptions<T>>
  create?: Partial<CreateOptions>
  update?: Partial<UpdateOptions>
  delete?: Partial<DeleteOptions>
  m2m?: Record<string, Table>
  o2m?: Record<string, Table>
}

// export type TableWithColumns<T extends Table = Table>
//   = T & { [K in ColKey<T>]: T['_']['columns'][K] }

export interface AdminModelConfig<T extends Table = Table> {
  // model: TableWithColumns<T>
  model: T
  label: string
  labelColumn: ColKey<T>
  lookupColumnName: ColKey<T>
  lookupColumn: T['_']['columns'][ColKey<T>]
  list: ListOptions<T>
  create: CreateOptions
  update: UpdateOptions
  delete: DeleteOptions
  m2m?: Record<string, Table>
  o2m?: Record<string, Table>
  // store
  columns: ReturnType<typeof getTableColumns<T>>
  metadata: TableMetadata
}

const generateDefaultOptions = <T extends Table>(model: T, label: string, apiPrefix: string, opts: AdminModelOptions<T>) => {
  const dct = {
    lookupColumnName: defaultLookupColumnName as ColKey<T>,
    list: {
      enabled: true,
      showCreateButton: true,
      enableSearch: true,
      searchPlaceholder: 'Search ...',
      title: toTitleCase(label),
      endpoint: `${apiPrefix}/${label}`,
    },
    update: { enabled: true, showDeleteButton: true, route: { name: 'autoadmin-update', params: { modelLabel: label } } },
    delete: { enabled: true, endpoint: `${apiPrefix}/${label}` },
    create: { enabled: true },
  } as AdminModelConfig<T>
  if (!opts.labelColumn) {
    dct.labelColumn = getLabelColumnFromModel(model)
  }
  if (opts.list?.enableSearch && !opts.list?.searchFields) {
    dct.list.searchFields = [opts.labelColumn || dct.labelColumn]
  } else if (!opts.list?.searchFields) {
    dct.list.searchFields = []
  }
  if (!opts.create?.schema) {
    dct.create.schema = createInsertSchema(model)
  }
  if (!opts.update?.schema) {
    dct.update.schema = createUpdateSchema(model)
  }
  return dct
}

// Global registry - maintains state across the application
// TODO May be use memory storage instead of globalThis
function getRegistry(): Map<string, AdminModelConfig> {
  // @ts-expect-error: attach to global for persistence
  if (!globalThis.__admin_registry__) {
    // @ts-expect-error: attach to global for persistence
    globalThis.__admin_registry__ = new Map<string, AdminModelConfig>()
  }

  // @ts-expect-error: attach to global for persistence
  return globalThis.__admin_registry__
}

export function useAdminRegistry() {
  const registry = getRegistry()
  const config = useRuntimeConfig()
  const apiPrefix = config.public.apiPrefix

  function registerAdminModel<T extends Table>(
    model: T,
    opts: AdminModelOptions<T> = {},
  ): void {
    const label = (opts.label ?? getTableName(model)) as string

    const cfg = defu(
      opts,
      generateDefaultOptions(model, label, apiPrefix, opts),
      { model, label },
    ) as AdminModelConfig<T>

    // Validate that lookupColumnName exists on the model's columns
    const lookupColumnName = cfg.lookupColumnName
    cfg.columns = getTableColumns(model)
    if (!Object.keys(cfg.columns).includes(lookupColumnName)) {
      if (lookupColumnName === defaultLookupColumnName) {
        throw new Error(
          `The default lookup field "${lookupColumnName}" does not exist on the table "${getTableName(model)}". Pass a different "lookupColumnName" value during registration. Available columns: ${Object.keys(modelColumns).join(', ')}`,
        )
      } else {
        throw new Error(
          `Invalid lookupColumnName "${lookupColumnName}" provided for model "${label}". Field does not exist on the table. Available columns: ${Object.keys(modelColumns).join(', ')}`,
        )
      }
    }
    // Check if lookupColumnName is either primary or unique
    const lookupColumn = cfg.columns[lookupColumnName]
    if (!lookupColumn.primary && !lookupColumn.isUnique) {
      throw new Error(
        `The lookup field "${lookupColumnName}" is not a primary or unique column on the table "${getTableName(model)}". Pass a different "lookupColumnName" value during registration.`,
      )
    }

    cfg.lookupColumn = cfg.columns[lookupColumnName] as T['_']['columns'][ColKey<T>]
    cfg.metadata = getTableMetadata(model)

    registry.set(label, cfg as unknown as AdminModelConfig<Table>)
  }

  function getAdminConfig<T extends Table = Table>(
    label: string,
  ): AdminModelConfig<T> | undefined {
    return registry.get(label) as AdminModelConfig<T> | undefined
  }

  return {
    all: () => Array.from(registry.values()) as AdminModelConfig<Table>[],
    get: getAdminConfig,
    register: registerAdminModel,
  }
}
