import { defineNuxtPlugin } from '#app'
import type { Table } from 'drizzle-orm'
import { getTableName } from "drizzle-orm"
import { defu } from 'defu'


type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

interface ListOptions<T extends Table = Table> {
  showCreateButton: boolean
  fields: ColKey<T>[]
}

interface UpdateOptions {
  showDeleteButton: boolean
}
export interface AdminModelOptions<T extends Table = Table> {
  label?: string
  searchFields?: ColKey<T>[]
  list?: Partial<ListOptions<T>>
  update?: Partial<UpdateOptions>
}

const defaultOptions = {
  list: { showCreateButton: true },
  update: { showDeleteButton: true },
} as const satisfies AdminModelOptions<Table>

export interface AdminModelConfig<T extends Table = Table>
  extends AdminModelOptions<T> {
  model: T
  label: string
}

const registry = new Map<string, AdminModelConfig>()

function registerAdminModel<T extends Table>(
  model: T,
  opts: AdminModelOptions<T> = {},
): void {
  const key = (opts.label ?? getTableName(model)) as string

  const cfg: AdminModelConfig<T> = defu(
    opts,
    defaultOptions,
    { model, label: key },
  )

  registry.set(key, cfg as unknown as AdminModelConfig<Table>)
}

function getAdminConfig<T extends Table = Table>(
  label: string,
): AdminModelConfig<T> | undefined {
  return registry.get(label) as AdminModelConfig<T> | undefined
}

function useAdminRegistry() {
  return {
    all: () =>
      Array.from(registry.values()) as AdminModelConfig<Table>[],
    get: getAdminConfig,
    register: registerAdminModel,
  }
}
export default defineNuxtPlugin({
  name: 'admin-registry',
  setup() {
    return {
      provide: {
        adminRegistry: useAdminRegistry(),
      },
    }
  }
})

declare module '#app' {
  interface NuxtApp {
    $adminRegistry: ReturnType<typeof useAdminRegistry>
  }
}
