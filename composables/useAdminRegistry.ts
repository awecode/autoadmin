import type { TableColumn } from '#ui/types'
import type { InferInsertModel, Table } from 'drizzle-orm'
import { defu } from 'defu'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'

type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

// TODO: Make this configurable - maybe global config?
const defaultLookupField = 'id'

interface ListOptions<T extends Table = Table> {
  enabled: boolean
  showCreateButton: boolean
  fields: ColKey<T>[]
  title?: string
  endpoint?: string
  columns?: TableColumn<T>[]
}

interface CreateOptions<T extends Table = Table> {
  enabled: boolean // added by staticDefaultOptions
  endpoint?: string
  schema: InferInsertModel<T> // added by generateDefaultOptions
}

interface UpdateOptions<T extends Table = Table> {
  enabled: boolean // added by staticDefaultOptions
  showDeleteButton: boolean
  schema: InferInsertModel<T> // added by generateDefaultOptions
}

interface DeleteOptions {
  enabled: boolean // added by staticDefaultOptions
  endpoint?: string
}

export interface AdminModelOptions<T extends Table = Table> {
  label?: string
  lookupField?: ColKey<T>
  searchFields?: ColKey<T>[]
  list?: Partial<ListOptions<T>>
  create?: Partial<CreateOptions>
  update?: Partial<UpdateOptions>
  delete?: Partial<DeleteOptions>
}

export type TableWithColumns<T extends Table = Table>
  = T & { [K in ColKey<T>]: T['_']['columns'][K] }

export interface AdminModelConfig<T extends Table = Table> {
  model: TableWithColumns<T>
  label: string
  lookupField: ColKey<T>
  list?: ListOptions<T>
  create: CreateOptions
  update: UpdateOptions
  delete: DeleteOptions
}

const staticDefaultOptions = {
  lookupField: defaultLookupField,
  list: { enabled: true, showCreateButton: true },
  update: { enabled: true, showDeleteButton: true },
  delete: { enabled: true },
} as const satisfies AdminModelOptions<Table>

const generateDefaultOptions = (model: Table) => {
  const insertSchema = createInsertSchema(model)
  const updateSchema = createUpdateSchema(model)
  return {
    create: { schema: insertSchema },
    update: { schema: updateSchema },
  }
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

  function registerAdminModel<T extends Table>(
    model: T,
    opts: AdminModelOptions<T> = {},
  ): void {
    const key = (opts.label ?? getTableName(model)) as string

    const cfg = defu(
      opts,
      staticDefaultOptions,
      generateDefaultOptions(model),
      { model, label: key },
    )

    // Validate that lookupField exists on the model's columns
    const lookupField = cfg.lookupField
    const modelColumns = getTableColumns(model)
    if (!Object.keys(modelColumns).includes(lookupField)) {
      if (lookupField === defaultLookupField) {
        throw new Error(
          `The default lookup field "${lookupField}" does not exist on the table "${getTableName(model)}". Pass a different "lookupField" value during registration. Available columns: ${Object.keys(modelColumns).join(', ')}`,
        )
      } else {
        throw new Error(
          `Invalid lookupField "${lookupField}" provied for model "${key}". Field does not exist on the table. Available columns: ${Object.keys(modelColumns).join(', ')}`,
        )
      }
    }

    registry.set(key, cfg as unknown as AdminModelConfig<Table>)
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
