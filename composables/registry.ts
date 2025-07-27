import type { CustomFilter, FilterType } from '#layers/autoadmin/server/utils/filter'
import type { FieldSpec, Option } from '#layers/autoadmin/server/utils/form'
import type { TableMetadata } from '#layers/autoadmin/server/utils/metdata'
import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm'
import type { DbType } from '../server/utils/db'
import { getTableMetadata } from '#layers/autoadmin/server/utils/metdata'
import { getLabelColumnFromColumns } from '#layers/autoadmin/utils/autoadmin'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { defu } from 'defu'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-zod'

// Represents a column name of table T
export type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>
// Represents a column name or relation string
type ColField<T extends Table> = ColKey<T> | `${ColKey<T>}.${string}`
// Represents a simple column name or relation string or a callable function (e.g., 'id', 'preferredLocationId.name', (model: InferSelectModel<T>) => any)
type ListField<T extends Table> = ColField<T> | ((model: InferSelectModel<T>) => any)
// Represents a sort key for a column or relation string
type SortKey<T extends Table> = ColField<T> | `${ColField<T>}.${string}` | false
// type TableWithColumns<T extends Table = Table> = T & { [K in ColKey<T>]: T['_']['columns'][K] }

export type FieldType = 'text' | 'email' | 'number' | 'boolean' | 'date' | 'datetime-local' | 'select' | 'json' | 'file' | 'blob' | 'image' | 'textarea' | 'rich-text' | 'relation' | 'relation-many'

export type FilterFieldDef<T extends Table> = ColField<T> | {
  field: ColField<T>
  label?: string
  type?: FilterType
  options?: Option[]
  choicesEndpoint?: string
} | CustomFilter

export type ListFieldDef<T extends Table>
  = ListField<T>
    | { // Represents a detailed field configuration object
      field: ListField<T> // Can be a column/relation string OR a callable function
      label?: string // Optional: custom display label for the field
      type?: FieldType // Optional: type hint (e.g., 'string', 'number', 'boolean', 'date')
      sortKey?: SortKey<T>
    }
export interface ListColumnDef<T extends Table> {
  id?: string
  accessorKey: string
  header?: string
  accessorFn?: (model: InferSelectModel<T>) => any
  type?: FieldType
  sortKey?: SortKey<T>
}

// TODO: Make this configurable - maybe global config?
const defaultLookupColumnName = 'id'

type ListOptions<T extends Table = Table> = {
  enabled: boolean
  showCreateButton: boolean
  enableSearch: boolean
  enableSort: boolean
  enableFilter: boolean
  searchPlaceholder?: string
  searchFields: ColField<T>[]
  bulkActions: {
    label: string
    icon?: string
    action: (db: DbType, rowIds: string[] | number[]) => Promise<{ message?: string, refresh?: boolean }>
  }[]
  title?: string
  endpoint?: string
  filterFields?: FilterFieldDef<T>[]
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
  warnOnUnsavedChanges: boolean
  formFields?: (ColKey<T> | FieldSpec)[]
}

interface UpdateOptions<T extends Table = Table> {
  enabled: boolean // added by staticDefaultOptions
  endpoint?: string
  // showDeleteButton: boolean
  route?: {
    name: string
    params: {
      modelLabel: string
    }
  }
  schema: InferInsertModel<T> // added by generateDefaultOptions
  warnOnUnsavedChanges: boolean
  formFields?: (ColKey<T> | FieldSpec)[]
}

interface DeleteOptions {
  enabled: boolean // added by staticDefaultOptions
  endpoint?: string
}

// AdminModelOptions is the options passed to the registerAdminModel function
export interface AdminModelOptions<T extends Table = Table> {
  label?: string
  icon?: string
  enableIndex?: boolean
  labelColumnName?: ColKey<T>
  lookupColumnName?: ColKey<T>
  // searchFields?: ColKey<T>[]
  list?: Partial<ListOptions<T>>
  create?: Partial<CreateOptions>
  update?: Partial<UpdateOptions>
  delete?: Partial<DeleteOptions>
  m2m?: Record<string, Table>
  o2m?: Record<string, Table>
  fields?: FieldSpec[] & { name: ColKey<T>, type: FieldType }[]
  warnOnUnsavedChanges?: boolean
  formFields?: (ColKey<T> | FieldSpec)[]
}

// AdminModelConfig is the config available in the registry after processing AdminModelOptions
export interface AdminModelConfig<T extends Table = Table> {
  // model: TableWithColumns<T>
  model: T
  label: string
  icon?: string
  enableIndex: boolean
  labelColumnName: ColKey<T>
  lookupColumnName: ColKey<T>
  lookupColumn: T['_']['columns'][ColKey<T>]
  list: ListOptions<T>
  create: CreateOptions
  update: UpdateOptions
  delete: DeleteOptions
  m2m?: Record<string, Table>
  o2m?: Record<string, Table>
  fields?: FieldSpec[] & { name: ColKey<T>, type: FieldType }[]
  warnOnUnsavedChanges: boolean
  // store
  columns: ReturnType<typeof getTableColumns<T>>
  metadata: TableMetadata
  apiPrefix: string
}

const getStaticDefaultOptions = () => ({
  enableIndex: true,
  lookupColumnName: defaultLookupColumnName,
  list: {
    enabled: true,
    enableSort: true,
    enableFilter: true,
    showCreateButton: true,
    enableSearch: true,
    searchPlaceholder: 'Search ...',
    bulkActions: [],
  },
  update: {
    enabled: true,
    // showDeleteButton: true,
  },
  delete: { enabled: true },
  create: { enabled: true },
  fields: undefined,
  warnOnUnsavedChanges: false,
})

const generateDefaultOptions = <T extends Table>(model: T, label: string, apiPrefix: string, opts: AdminModelOptions<T>) => {
  const dct = defu(getStaticDefaultOptions(), {
    list: {
      title: toTitleCase(label),
      endpoint: `${apiPrefix}/${label}`,
    },
    update: { route: { name: 'autoadmin-update', params: { modelLabel: label } } },
    delete: { endpoint: `${apiPrefix}/${label}` },
  }) as unknown as AdminModelConfig<T>
  if ((typeof opts.list?.enableSearch === 'undefined' || opts.list?.enableSearch === true) && !opts.list?.searchFields) {
    dct.list.searchFields = [opts.labelColumnName || dct.labelColumnName]
  } else if (!opts.list?.searchFields) {
    dct.list.searchFields = []
  }
  if (!opts.create?.schema) {
    dct.create.schema = createInsertSchema(model)
  }
  if (!opts.update?.schema) {
    dct.update.schema = createInsertSchema(model)
  }
  dct.warnOnUnsavedChanges = opts.warnOnUnsavedChanges ?? dct.warnOnUnsavedChanges
  dct.create.warnOnUnsavedChanges = opts.create?.warnOnUnsavedChanges ?? dct.warnOnUnsavedChanges
  dct.update.warnOnUnsavedChanges = opts.update?.warnOnUnsavedChanges ?? dct.warnOnUnsavedChanges
  dct.create.formFields = opts.create?.formFields ?? opts.formFields
  dct.update.formFields = opts.update?.formFields ?? opts.formFields
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

    const columns = getTableColumns(model)
    if (!opts.labelColumnName) {
      opts.labelColumnName = getLabelColumnFromColumns(columns) as ColKey<T>
    }

    const cfg = defu(
      opts,
      generateDefaultOptions(model, label, apiPrefix, opts),
      { model, label },
    ) as AdminModelConfig<T>

    cfg.columns = columns
    cfg.apiPrefix = apiPrefix

    const lookupColumnName = cfg.lookupColumnName
    // Validate that lookupColumnName exists on the model's columns
    const lookupColumn = cfg.columns[lookupColumnName]
    if (!lookupColumn) {
      if (lookupColumnName === defaultLookupColumnName) {
        throw new Error(
          `The default lookup field "${lookupColumnName}" does not exist on the table "${getTableName(model)}". Pass a different "lookupColumnName" value during registration. Available columns: ${Object.keys(cfg.columns).join(', ')}`,
        )
      } else {
        throw new Error(
          `Invalid lookupColumnName "${lookupColumnName}" provided for model "${label}". Field does not exist on the table. Available columns: ${Object.keys(cfg.columns).join(', ')}`,
        )
      }
    }
    // Check if lookupColumnName is either primary or unique
    if (!lookupColumn.primary && !lookupColumn.isUnique) {
      throw new Error(
        `The lookup field "${lookupColumnName}" is not a primary or unique column on the table "${getTableName(model)}". Pass a different "lookupColumnName" value during registration.`,
      )
    }

    cfg.lookupColumn = cfg.columns[lookupColumnName] as T['_']['columns'][ColKey<T>]
    cfg.metadata = getTableMetadata(cfg.columns)

    registry.set(label, cfg as unknown as AdminModelConfig<Table>)
  }

  function getAdminConfig<T extends Table = Table>(
    label: string,
  ): AdminModelConfig<T> | undefined {
    return registry.get(label) as AdminModelConfig<T> | undefined
  }

  return {
    all: () => Array.from(registry.values()) as AdminModelConfig<Table>[],
    map: () => registry,
    get: getAdminConfig,
    register: registerAdminModel,
  }
}
