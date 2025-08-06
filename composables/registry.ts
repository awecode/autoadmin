import type { CustomFilter, FilterType } from '#layers/autoadmin/server/utils/filter'
import type { FieldSpec, Option } from '#layers/autoadmin/server/utils/form'
import type { TableMetadata } from '#layers/autoadmin/server/utils/metdata'
import type { InferInsertModel, InferSelectModel, SQL, Table } from 'drizzle-orm'
import type { DbType } from '../server/utils/db'
import { getTableMetadata } from '#layers/autoadmin/server/utils/metdata'
import { getLabelColumnFromColumns } from '#layers/autoadmin/utils/autoadmin'
import { createNoSpaceString, toTitleCase } from '#layers/autoadmin/utils/string'
import { defu } from 'defu'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-zod'

// Represents a column name of table T
export type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>
// Represents a column name or relation string
type ColField<T extends Table> = ColKey<T> | `${ColKey<T>}.${string}`
// Represent a table column
export type ColOfTable<T extends Table> = T['_']['columns'][ColKey<T>]

export type CustomSelections = Record<string, { sql: SQL, isAggregate?: boolean, label?: string }>
// Represents a simple column name or relation string or a callable function (e.g., 'id', 'preferredLocationId.name', (model: InferSelectModel<T>) => any)
type ListField<T extends Table, C extends CustomSelections> = ColField<T> | ((db: DbType, model: InferSelectModel<T> & { [K in keyof C]?: unknown }) => Promise<any>)
// Represents a sort key for a column or relation string
type SortKey<T extends Table> = ColField<T> | `${ColField<T>}.${string}` | false
// type TableWithColumns<T extends Table = Table> = T & { [K in ColKey<T>]: T['_']['columns'][K] }

export type FieldType = 'text' | 'email' | 'number' | 'boolean' | 'date' | 'datetime-local' | 'select' | 'json' | 'file' | 'blob' | 'image' | 'textarea' | 'rich-text' | 'relation' | 'relation-many'

export type FilterFieldDef<T extends Table> = ColKey<T> | {
  field: ColKey<T>
  label?: string
  type?: FilterType
  options?: Option[]
  choicesEndpoint?: string
} | CustomFilter

export type ListFieldDef<T extends Table, C extends CustomSelections = CustomSelections>
  = ListField<T, C>
    | { // Represents a detailed field configuration object
      field: ListField<T, C> // Can be a column/relation string OR a callable function
      label?: string // Optional: custom display label for the field
      type?: FieldType // Optional: type hint (e.g., 'string', 'number', 'boolean', 'date')
      sortKey?: SortKey<T>
      cell?: ({ row }: { row: InferSelectModel<T> }) => string
    }
export interface ListColumnDef<T extends Table> {
  id?: string
  accessorKey: string
  header?: string
  accessorFn?: (db: DbType, model: InferSelectModel<T>) => Promise<any>
  type?: FieldType
  sortKey?: SortKey<T>
}

// TODO: Make this configurable - maybe global config?
const defaultLookupColumnName = 'id'

export const aggregateFunctions = ['avg', 'sum', 'min', 'max', 'count'] as const

interface ListOptions<T extends Table = Table, C extends CustomSelections = CustomSelections> {
  showCreateButton: boolean
  enableSearch: boolean
  enableSort: boolean
  enableFilter: boolean
  searchPlaceholder?: string
  searchFields: ColField<T>[]
  customSelections?: C
  aggregates?: Record<string, { function: (typeof aggregateFunctions)[number], column: ColKey<T> | ColOfTable<T>, label?: string }>
  bulkActions: {
    label: string
    icon?: string
    action: (db: DbType, rowIds: string[] | number[]) => Promise<{ message?: string, refresh?: boolean }>
  }[]
  title?: string
  endpoint?: string
  filterFields?: FilterFieldDef<T>[]
  fields?: Array<ListFieldDef<T, C>>
  // Do not allow both fields and columns to be set at the same time
}

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
      modelKey: string
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

/** AdminModelOptions is the options passed to the register function */
export interface AdminModelOptions<T extends Table = Table, C extends CustomSelections = CustomSelections> {
  /** A unique identifier for the model. If not provided, the table name will be used. Must not contain any space characters. */
  key?: string
  label?: string
  icon?: string
  enableIndex?: boolean
  labelColumnName?: ColKey<T>
  lookupColumnName?: ColKey<T>
  // searchFields?: ColKey<T>[]
  list?: Partial<ListOptions<T, C>>
  create?: Partial<CreateOptions>
  update?: Partial<UpdateOptions>
  delete?: Partial<DeleteOptions>
  m2m?: Record<string, Table>
  o2m?: Record<string, Table>
  fields?: Omit<FieldSpec, 'type'>[] & { name: ColKey<T>, type?: FieldType }[]
  warnOnUnsavedChanges?: boolean
  formFields?: (ColKey<T> | FieldSpec)[]
}

// AdminModelConfig is the config available in the registry after processing AdminModelOptions
export interface AdminModelConfig<T extends Table = Table, C extends CustomSelections = CustomSelections> {
  // model: TableWithColumns<T>
  model: T
  key: string
  label: string
  icon?: string
  enableIndex: boolean
  labelColumnName: ColKey<T>
  lookupColumnName: ColKey<T>
  lookupColumn: T['_']['columns'][ColKey<T>]
  list: ListOptions<T, C>
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

const generateDefaultOptions = <T extends Table, C extends CustomSelections = CustomSelections>(model: T, label: string, key: string, apiPrefix: string, opts: AdminModelOptions<T, C>) => {
  const dct = defu(getStaticDefaultOptions(), {
    list: {
      title: toTitleCase(label),
      endpoint: `${apiPrefix}/${key}`,
    },
    update: { route: { name: 'autoadmin-update', params: { modelKey: key } } },
    delete: { endpoint: `${apiPrefix}/${key}` },
  }) as unknown as AdminModelConfig<T, C>
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
function getRegistry(): Map<string, AdminModelConfig<Table, CustomSelections>> {
  // @ts-expect-error: attach to global for persistence
  if (!globalThis.__admin_registry__) {
    // @ts-expect-error: attach to global for persistence
    globalThis.__admin_registry__ = new Map<string, AdminModelConfig<Table, CustomSelections>>()
  }

  // @ts-expect-error: attach to global for persistence
  return globalThis.__admin_registry__
}

export function useAdminRegistry() {
  const registry = getRegistry()
  const config = useRuntimeConfig()
  const apiPrefix = config.public.apiPrefix

  function configure<T extends Table, C extends CustomSelections = CustomSelections>(
    model: T,
    opts: AdminModelOptions<T, C> = {},
  ) {
    const key = opts.key ? createNoSpaceString(opts.key) : getTableName(model)
    const label = opts.label ?? toTitleCase(key)

    const columns = getTableColumns(model)
    if (!opts.labelColumnName) {
      opts.labelColumnName = getLabelColumnFromColumns(columns) as ColKey<T>
    }

    const cfg = defu(
      opts,
      generateDefaultOptions(model, label, key, apiPrefix, opts),
      { model, key, label },
    ) as AdminModelConfig<T, C>

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
    return cfg
  }

  function register<T extends Table, C extends CustomSelections = CustomSelections>(
    model: T,
    opts: AdminModelOptions<T, C> = {},
  ): void {
    const cfg = configure(model, opts)
    registry.set(cfg.key, cfg as unknown as AdminModelConfig<Table, C>)
  }

  function getModelConfig<T extends Table>(
    key: string,
  ): AdminModelConfig<T> | undefined {
    return registry.get(key) as AdminModelConfig<T> | undefined
  }

  return {
    all: () => Array.from(registry.values()) as AdminModelConfig<Table>[],
    map: () => registry,
    get: getModelConfig,
    configure,
    register,
  }
}
