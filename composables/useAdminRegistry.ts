import type { Table } from 'drizzle-orm'
import { getTableName } from "drizzle-orm"
import { defu } from 'defu'

type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

interface ListOptions<T extends Table = Table> {
    enabled: boolean
    showCreateButton: boolean
    fields: ColKey<T>[]
    title?: string
    endpoint?: string
}

interface UpdateOptions {
    enabled: boolean
    showDeleteButton: boolean
}

interface DeleteOptions {
    enabled: boolean
    endpoint?: string
}

export interface AdminModelOptions<T extends Table = Table> {
    label?: string
    searchFields?: ColKey<T>[]
    list?: Partial<ListOptions<T>>
    update?: Partial<UpdateOptions>
    delete?: Partial<DeleteOptions>
}

const defaultOptions = {
    list: { enabled: true, showCreateButton: true },
    update: { enabled: true, showDeleteButton: true },
    delete: { enabled: true },
} as const satisfies AdminModelOptions<Table>

export interface AdminModelConfig<T extends Table = Table>
    extends AdminModelOptions<T> {
    model: T
    label: string
}

// Global registry - maintains state across the application
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

export function useAdminRegistry() {
    return {
        all: () =>
            Array.from(registry.values()) as AdminModelConfig<Table>[],
        get: getAdminConfig,
        register: registerAdminModel,
    }
} 