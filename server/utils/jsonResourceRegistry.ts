import type { FieldSpec } from '#layers/autoadmin/server/utils/form'
import type { JsonStorageConfig } from '#layers/autoadmin/server/utils/jsonStorage/factory'
import type { JsonStorageRegisterDiscriminated } from '#layers/autoadmin/server/utils/jsonStorage/normalizeRegisterStorage'
import type { FieldType } from '#layers/autoadmin/server/utils/registry'
import type { ZodObject, ZodType } from 'zod'
import type { AutoadminRolesConfig } from './roleAccess'
import { basename } from 'node:path'
import { buildJsonStorageConfig } from '#layers/autoadmin/server/utils/jsonStorage/normalizeRegisterStorage'
import { resolveJsonAdminApiPrefix } from '#layers/autoadmin/utils/jsonAdminApiPrefix'
import { createNoSpaceString, slugify, toTitleCase } from '#layers/autoadmin/utils/string'
import { defu } from 'defu'
import { z } from 'zod'
import { normalizeAutoadminRolesInput } from './roleHelpers'

export const JSON_OBJECT_LOOKUP = '__root__'
/** Internal row key for JSON array resources; UUID assigned by server; not shown in list/form. */
export const JSON_ARRAY_ROW_ID = '_id' as const
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
  /**
   * Role allowlists: `string[]` or an object for per-action roles.
   */
  roles?: string[] | AutoadminRolesConfig
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
  /** Zod object for one array element; `_id` is reserved (added internally). */
  elementSchema: ZodObject<Record<string, ZodType>>
  /** List/search label column; defaults to first `elementSchema` key (excluding `_id`). */
  labelField?: string
  list?: Partial<JsonArrayListOptions>
  create?: Partial<JsonCreateOptions>
  update?: Partial<JsonUpdateOptions>
  delete?: Partial<JsonDeleteOptions>
  fields?: FieldSpec[]
  warnOnUnsavedChanges?: boolean
  /**
   * Role allowlists: `string[]` or an object for per-action roles.
   */
  roles?: string[] | AutoadminRolesConfig
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
  /** Normalized from `RegisterJsonObjectResourceInput.roles` (array → `{ full }`). */
  roles?: AutoadminRolesConfig
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
  /** Normalized from `RegisterJsonArrayResourceInput.roles` (array → `{ full }`). */
  roles?: AutoadminRolesConfig
}

export type JsonResourceConfig = JsonObjectResourceConfig | JsonArrayResourceConfig

function getJsonRegistry(): Map<string, JsonResourceConfig> {
  const g = globalThis as typeof globalThis & { __autoadminJsonResources?: Map<string, JsonResourceConfig> }
  if (!g.__autoadminJsonResources) {
    g.__autoadminJsonResources = new Map()
  }
  return g.__autoadminJsonResources
}

/** Default registry key from `path`: basename without `.json`, slugified (e.g. `config/site.json` → `site`). */
function inferJsonArrayLabelField(
  resourceKey: string,
  userSchema: ZodObject<Record<string, ZodType>>,
  explicit?: string,
): string {
  if (explicit?.trim()) {
    const lf = explicit.trim()
    if (!(lf in userSchema.shape)) {
      throw new Error(`JSON admin array "${resourceKey}": labelField "${lf}" is not on elementSchema.`)
    }
    return lf
  }
  const keys = Object.keys(userSchema.shape).filter(k => k !== JSON_ARRAY_ROW_ID)
  if (!keys.length) {
    throw new Error(
      `JSON admin array "${resourceKey}": add \`labelField\` or at least one field in elementSchema (not "${JSON_ARRAY_ROW_ID}").`,
    )
  }
  return keys[0]!
}

function defaultKeyFromPath(pathInput: string | undefined): string | undefined {
  const raw = pathInput?.trim()
  if (!raw) {
    return undefined
  }
  const normalized = raw.replace(/\\/g, '/')
  const base = basename(normalized).replace(/\.json$/i, '')
  const key = slugify(base)
  return key || undefined
}

function jsonApiPrefix(): string {
  return resolveJsonAdminApiPrefix(useRuntimeConfig().public)
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
    icon: input.icon ?? 'i-lucide-braces',
    enableIndex: input.enableIndex ?? true,
    storage,
    commitMessagePrefix: input.commitMessagePrefix ?? `[autoadmin-json:${key}] `,
    schema: input.schema,
    update,
    fields: input.fields,
    warnOnUnsavedChanges: input.warnOnUnsavedChanges ?? false,
    apiPrefix,
    roles: normalizeAutoadminRolesInput(input.roles),
  }
}

function defaultArrayConfig(
  key: string,
  label: string,
  apiPrefix: string,
  input: RegisterJsonArrayResourceInput,
): JsonArrayResourceConfig {
  const storage = buildJsonStorageConfig(input, key)
  const userSchema = input.elementSchema
  if (JSON_ARRAY_ROW_ID in userSchema.shape) {
    throw new Error(`JSON admin array "${key}": "${JSON_ARRAY_ROW_ID}" is reserved — remove it from elementSchema.`)
  }
  const elementSchema = userSchema.extend({
    _id: z.string().uuid().optional(),
  })
  const labelField = inferJsonArrayLabelField(key, userSchema, input.labelField)
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
    icon: input.icon ?? 'i-lucide-brackets',
    enableIndex: input.enableIndex ?? true,
    storage,
    commitMessagePrefix: input.commitMessagePrefix ?? `[autoadmin-json:${key}] `,
    elementSchema,
    idField: JSON_ARRAY_ROW_ID,
    labelField,
    list,
    create,
    update,
    delete: deleteOpts,
    fields: input.fields,
    warnOnUnsavedChanges: input.warnOnUnsavedChanges ?? false,
    apiPrefix,
    roles: normalizeAutoadminRolesInput(input.roles),
  }
}

export function useJsonResourceRegistry() {
  const registry = getJsonRegistry()

  function register(input: RegisterJsonResourceInput): void {
    if (!import.meta.server) {
      return
    }
    const apiPrefix = jsonApiPrefix()
    const key = input.key
      ? createNoSpaceString(input.key)
      : (defaultKeyFromPath(input.path) ?? `json-${registry.size + 1}`)
    const label = input.label ?? toTitleCase(key.replace(/-/g, ' '))

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
