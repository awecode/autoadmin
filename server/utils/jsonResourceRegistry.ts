import type { FieldSpec } from '#layers/autoadmin/server/utils/form'
import type { JsonStorageConfig } from '#layers/autoadmin/server/utils/jsonStorage/factory'
import type { JsonStorageRegisterDiscriminated } from '#layers/autoadmin/server/utils/jsonStorage/normalizeRegisterStorage'
import type { FieldType } from '#layers/autoadmin/server/utils/registry'
import type { ZodObject, ZodType } from 'zod'
import { buildJsonStorageConfig } from '#layers/autoadmin/server/utils/jsonStorage/normalizeRegisterStorage'
import { createNoSpaceString, toTitleCase } from '#layers/autoadmin/utils/string'
import { defu } from 'defu'

export const JSON_OBJECT_LOOKUP = '__root__'
export type JsonResourceKind = 'object' | 'array'
export interface JsonArrayListFieldDef {
  field: string
  label?: string
  type?: FieldType
  sortKey?: string
}

export interface JsonArrayListOptions {
  title?: string
  endpoint?: string
  showCreateButton?: boolean
  enableSearch?: boolean
  enableSort?: boolean
  searchPlaceholder?: string
  searchFields?: string[]
  fields?: Array<JsonArrayListFieldDef | string>
}

export interface JsonCrudRoute {
  name: string
  params?: Record<string, string>
}

export interface JsonCreateOptions {
  enabled: boolean
  endpoint?: string
  route?: JsonCrudRoute
  warnOnUnsavedChanges?: boolean
  formFields?: (string | FieldSpec)[]
}

export interface JsonUpdateOptions {
  enabled: boolean
  endpoint?: string
  route?: JsonCrudRoute
  warnOnUnsavedChanges?: boolean
  formFields?: (string | FieldSpec)[]
}

export interface JsonDeleteOptions {
  enabled: boolean
  endpoint?: string
}

export interface RegisterJsonObjectResourceInput {
  kind: 'object'
  key?: string
  label?: string
  icon?: string
  enableIndex?: boolean
  path?: string
  storage?: JsonStorageRegisterDiscriminated
  githubToken?: string
  commitMessagePrefix?: string
  /** Zod object describing the root JSON document. */
  schema: ZodObject<Record<string, ZodType>>
  update?: Partial<JsonUpdateOptions>
  fields?: FieldSpec[]
  warnOnUnsavedChanges?: boolean
}

export interface RegisterJsonArrayResourceInput {
  kind: 'array'
  key?: string
  label?: string
  icon?: string
  enableIndex?: boolean
  path?: string
  storage?: JsonStorageRegisterDiscriminated
  githubToken?: string
  commitMessagePrefix?: string
  /** Zod object describing one array element. */
  elementSchema: ZodObject<Record<string, ZodType>>
  idField: string
  labelField?: string
  list?: Partial<JsonArrayListOptions>
  create?: Partial<JsonCreateOptions>
  update?: Partial<JsonUpdateOptions>
  delete?: Partial<JsonDeleteOptions>
  fields?: FieldSpec[]
  warnOnUnsavedChanges?: boolean
}

export type RegisterJsonResourceInput = RegisterJsonObjectResourceInput | RegisterJsonArrayResourceInput

export interface JsonObjectResourceConfig {
  kind: 'object'
  key: string
  label: string
  icon?: string
  enableIndex: boolean
  storage: JsonStorageConfig
  commitMessagePrefix: string
  schema: ZodObject<Record<string, ZodType>>
  update: JsonUpdateOptions
  fields?: FieldSpec[]
  warnOnUnsavedChanges: boolean
  apiPrefix: string
}

export interface JsonArrayResourceConfig {
  kind: 'array'
  key: string
  label: string
  icon?: string
  enableIndex: boolean
  storage: JsonStorageConfig
  commitMessagePrefix: string
  elementSchema: ZodObject<Record<string, ZodType>>
  idField: string
  labelField: string
  list: JsonArrayListOptions & {
    title: string
    endpoint: string
    showCreateButton: boolean
    enableSearch: boolean
    enableSort: boolean
    searchPlaceholder: string
    searchFields: string[]
    bulkActions: []
  }
  create: JsonCreateOptions
  update: JsonUpdateOptions
  delete: JsonDeleteOptions
  fields?: FieldSpec[]
  warnOnUnsavedChanges: boolean
  apiPrefix: string
}

export type JsonResourceConfig = JsonObjectResourceConfig | JsonArrayResourceConfig

function getJsonRegistry(): Map<string, JsonResourceConfig> {
  const g = globalThis as typeof globalThis & { __autoadminJsonResources?: Map<string, JsonResourceConfig> }
  if (!g.__autoadminJsonResources) {
    g.__autoadminJsonResources = new Map()
  }
  return g.__autoadminJsonResources
}

function jsonApiPrefix(): string {
  const config = useRuntimeConfig()
  const pub = config.public as { jsonAdmin?: { apiPrefix?: string }, autoadmin?: { apiPrefix?: string } }
  const explicit = String(pub.jsonAdmin?.apiPrefix ?? '').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  if (explicit) {
    return explicit.startsWith('/') ? explicit : `/${explicit}`
  }
  const base = String(pub.autoadmin?.apiPrefix ?? '/api/autoadmin').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  const baseAbs = base.startsWith('/') ? base : `/${base}`
  return `${baseAbs}/json`
}

function defaultObjectConfig(
  key: string,
  label: string,
  apiPrefix: string,
  input: RegisterJsonObjectResourceInput,
): JsonObjectResourceConfig {
  const storage = buildJsonStorageConfig(input, key)
  const update = defu(input.update ?? {}, {
    enabled: true,
    route: { name: 'jsonadmin-object-edit', params: { modelKey: key } },
    warnOnUnsavedChanges: input.warnOnUnsavedChanges ?? false,
  }) as JsonUpdateOptions
  if (!update.endpoint) {
    update.endpoint = `${apiPrefix}/${key}/${JSON_OBJECT_LOOKUP}`
  }
  return {
    kind: 'object',
    key,
    label,
    icon: input.icon,
    enableIndex: input.enableIndex ?? true,
    storage,
    commitMessagePrefix: input.commitMessagePrefix ?? `[autoadmin-json:${key}] `,
    schema: input.schema,
    update,
    fields: input.fields,
    warnOnUnsavedChanges: input.warnOnUnsavedChanges ?? false,
    apiPrefix,
  }
}

function defaultArrayConfig(
  key: string,
  label: string,
  apiPrefix: string,
  input: RegisterJsonArrayResourceInput,
): JsonArrayResourceConfig {
  const storage = buildJsonStorageConfig(input, key)
  const idField = input.idField
  const labelField = input.labelField ?? idField
  const list = defu(input.list ?? {}, {
    title: toTitleCase(label),
    endpoint: `${apiPrefix}/${key}`,
    showCreateButton: true,
    enableSearch: true,
    enableSort: true,
    searchPlaceholder: 'Search …',
    searchFields: [labelField],
    bulkActions: [],
  }) as JsonArrayResourceConfig['list']

  const create = defu(input.create ?? {}, {
    enabled: true,
    route: { name: 'jsonadmin-array-create', params: { modelKey: key } },
    warnOnUnsavedChanges: input.warnOnUnsavedChanges ?? false,
  }) as JsonCreateOptions
  if (!create.endpoint) {
    create.endpoint = `${apiPrefix}/${key}`
  }

  const update = defu(input.update ?? {}, {
    enabled: true,
    route: { name: 'jsonadmin-array-update', params: { modelKey: key } },
    warnOnUnsavedChanges: input.warnOnUnsavedChanges ?? false,
  }) as JsonUpdateOptions

  const deleteOpts = defu(input.delete ?? {}, {
    enabled: true,
  }) as JsonDeleteOptions
  if (!deleteOpts.endpoint) {
    deleteOpts.endpoint = `${apiPrefix}/${key}`
  }

  return {
    kind: 'array',
    key,
    label,
    icon: input.icon,
    enableIndex: input.enableIndex ?? true,
    storage,
    commitMessagePrefix: input.commitMessagePrefix ?? `[autoadmin-json:${key}] `,
    elementSchema: input.elementSchema,
    idField,
    labelField,
    list,
    create,
    update,
    delete: deleteOpts,
    fields: input.fields,
    warnOnUnsavedChanges: input.warnOnUnsavedChanges ?? false,
    apiPrefix,
  }
}

export function useJsonResourceRegistry() {
  const registry = getJsonRegistry()

  function register(input: RegisterJsonResourceInput): void {
    if (!import.meta.server) {
      return
    }
    const apiPrefix = jsonApiPrefix()
    const key = input.key ? createNoSpaceString(input.key) : `resource-${registry.size + 1}`
    const label = input.label ?? toTitleCase(key)

    if (input.kind === 'object') {
      registry.set(key, defaultObjectConfig(key, label, apiPrefix, input))
    }
    else {
      registry.set(key, defaultArrayConfig(key, label, apiPrefix, input))
    }
  }

  function get(key: string): JsonResourceConfig | undefined {
    return registry.get(key)
  }

  function all(): JsonResourceConfig[] {
    return Array.from(registry.values())
  }

  return { register, get, all, apiPrefix: jsonApiPrefix() }
}
