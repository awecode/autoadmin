import type { TableColumn } from '#ui/types'
import type { InferInsertModel, Table } from 'drizzle-orm'
import { defu } from 'defu'
import { getTableName } from 'drizzle-orm'
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod'

type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

interface ListOptions<T extends Table = Table> {
  enabled: boolean
  showCreateButton: boolean
  fields: ColKey<T>[]
  title?: string
  endpoint?: string
  columns?: TableColumn<T>[]
}

interface CreateOptions<T extends Table = Table> {
  enabled?: boolean
  endpoint?: string
  schema?: InferInsertModel<T>
}

interface UpdateOptions<T extends Table = Table> {
  enabled: boolean
  showDeleteButton: boolean
  schema?: InferInsertModel<T>
}

interface DeleteOptions {
  enabled: boolean
  endpoint?: string
}

export interface AdminModelOptions<T extends Table = Table> {
  label?: string
  searchFields?: ColKey<T>[]
  list?: Partial<ListOptions<T>>
  create?: Partial<CreateOptions>
  update?: Partial<UpdateOptions>
  delete?: Partial<DeleteOptions>
}

export interface AdminModelConfig<T extends Table = Table> {
  model: T
  label: string
  list?: ListOptions<T>
  create: CreateOptions
  update: UpdateOptions
  delete: DeleteOptions
}

const staticDefaultOptions = {
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
