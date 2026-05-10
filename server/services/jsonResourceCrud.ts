import type { JsonArrayResourceConfig, JsonObjectResourceConfig, JsonResourceConfig } from '#layers/autoadmin/server/utils/jsonResourceRegistry'
import type { JsonStorageConfig } from '#layers/autoadmin/server/utils/jsonStorage/factory'
import type { ZodObject, ZodType } from 'zod'
import { genericPaginationQuerySchema } from '#layers/autoadmin/server/utils/drizzle'
import { JSON_ARRAY_ROW_ID, JSON_OBJECT_LOOKUP } from '#layers/autoadmin/server/utils/jsonResourceRegistry'
import { createJsonStorageRepository } from '#layers/autoadmin/server/utils/jsonStorage/factory'
import { zodToListSpec } from '#layers/autoadmin/server/utils/list'
import { unwrapZodType } from '#layers/autoadmin/server/utils/zod'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { z } from 'zod'

function paginateArray<T>(rows: T[], query: Record<string, any>) {
  const paginationConfig = useRuntimeConfig().public.pagination
  const q = { ...query }
  q.size = q.size ?? (paginationConfig && typeof paginationConfig === 'object' && 'defaultSize' in paginationConfig && typeof paginationConfig.defaultSize === 'number' ? paginationConfig.defaultSize : 20)
  const maxSize = paginationConfig && typeof paginationConfig === 'object' && 'maxSize' in paginationConfig && typeof paginationConfig.maxSize === 'number' ? paginationConfig.maxSize : 200
  if (Number(q.size) > maxSize) {
    q.size = maxSize
  }
  const { page, size } = genericPaginationQuerySchema.parse(q)
  const totalCount = rows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / size))
  const offset = (page - 1) * size
  if (page > 1 && offset >= totalCount) {
    throw createError({
      statusCode: 404,
      statusMessage: 'The requested page does not exist.',
    })
  }
  return {
    results: rows.slice(offset, offset + size),
    pagination: {
      count: totalCount,
      page,
      size,
      pages: totalPages,
    },
  }
}

function jsonStorageSourceHint(storage: JsonStorageConfig): string {
  if (storage.kind === 'local') {
    return storage.absolutePath
  }
  return `${storage.owner}/${storage.repo}@${storage.ref}:${storage.path}`
}

/**
 * Drop `null` / `undefined` at the root only so Zod `.default()` runs for missing keys
 * (JSON often uses `"field": null` before a real value exists).
 */
function omitNullUndefinedShallow(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) {
      continue
    }
    out[k] = v
  }
  return out
}

interface ZodInnerDef {
  type?: string
  coerce?: boolean
  entries?: Record<string, string | number>
  values?: unknown[]
}

/** Missing keys on object read: Zod defaults, else sentinels from inner `_def.type` (Zod 4). */
function fallbackValueForMissingReadField(fieldSchema: ZodType): unknown | undefined {
  const { innerType, isOptional, defaultValue } = unwrapZodType(fieldSchema)
  if (defaultValue !== undefined) {
    return defaultValue
  }
  if (isOptional) {
    return undefined
  }
  const def = (innerType as ZodType & { _def?: ZodInnerDef })._def
  const t = def?.type
  if (t === 'string') {
    return ''
  }
  if (t === 'number' || t === 'int') {
    return 0
  }
  if (t === 'boolean') {
    return false
  }
  if (t === 'bigint') {
    return BigInt(0)
  }
  if (t === 'enum' && def.entries) {
    return Object.values(def.entries)[0]
  }
  if (t === 'literal' && Array.isArray(def.values)) {
    return def.values[0]
  }
  if (t === 'object') {
    return {}
  }
  if (t === 'array') {
    return []
  }
  if (t === 'date') {
    return new Date(0)
  }
  return undefined
}

function mergeMissingJsonReadDefaults(
  schema: ZodObject<Record<string, ZodType>>,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw }
  const shape = schema.shape
  for (const key of Object.keys(shape)) {
    if (key in out && out[key] !== undefined) {
      continue
    }
    const fb = fallbackValueForMissingReadField(shape[key]!)
    if (fb !== undefined) {
      out[key] = fb
    }
  }
  return out
}

function parseObjectSchemaOr422(
  schema: ZodObject<Record<string, ZodType>>,
  raw: Record<string, unknown>,
  sourceHint?: string,
): Record<string, any> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const detail = result.error.issues
      .map(i => `${i.path.length ? i.path.join('.') : 'root'}: ${i.message}`)
      .join('; ')
    const truncated = detail.length > 320 ? `${detail.slice(0, 320)}…` : detail
    const pathHint = sourceHint ? ` (${sourceHint})` : ''
    throw createError({
      statusCode: 422,
      statusMessage: `JSON schema validation failed: ${truncated}${pathHint}`,
      data: result.error.flatten(),
    })
  }
  return result.data as Record<string, any>
}

function rowMatchesSearch(row: Record<string, any>, q: string, fields: string[]): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) {
    return true
  }
  for (const f of fields) {
    const v = row[f]
    if (v !== undefined && v !== null && String(v).toLowerCase().includes(needle)) {
      return true
    }
  }
  return false
}

function compareForSort(a: unknown, b: unknown): number {
  if (a === b) {
    return 0
  }
  if (a === undefined || a === null) {
    return 1
  }
  if (b === undefined || b === null) {
    return -1
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime()
  }
  return String(a).localeCompare(String(b))
}

function sortRows(rows: Record<string, any>[], ordering: string | undefined, enableSort: boolean): Record<string, any>[] {
  if (!enableSort || !ordering || typeof ordering !== 'string') {
    return rows
  }
  const [col, dir] = ordering.split(':')
  if (!col) {
    return rows
  }
  const desc = dir === 'desc'
  const copy = [...rows]
  copy.sort((ra, rb) => {
    const c = compareForSort(ra[col], rb[col])
    return desc ? -c : c
  })
  return copy
}

/** Assign UUID when `idKey` missing/empty; returns whether any row changed. */
function ensureInternalRowIds(rows: Record<string, any>[], idKey: string): boolean {
  let changed = false
  for (const row of rows) {
    const v = row[idKey]
    if (v === undefined || v === null || v === '') {
      row[idKey] = crypto.randomUUID()
      changed = true
    }
  }
  return changed
}

async function readValidatedArrayRows(cfg: JsonArrayResourceConfig): Promise<Record<string, any>[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const repo = createJsonStorageRepository(cfg.storage, cfg.kind)
    const { parsed, revision } = await repo.read()
    if (!Array.isArray(parsed)) {
      throw createError({
        statusCode: 422,
        statusMessage: 'JSON file must contain an array for this resource.',
      })
    }
    const rows = z.array(cfg.elementSchema).parse(parsed) as Record<string, any>[]
    const addedIds = ensureInternalRowIds(rows, cfg.idField)
    assertUniqueIds(rows, cfg.idField)
    if (!addedIds) {
      return rows
    }
    try {
      await repo.write({
        bodyUtf8: `${JSON.stringify(rows, null, 2)}\n`,
        revision,
        message: `${cfg.commitMessagePrefix}assign ${JSON_ARRAY_ROW_ID}`,
      })
      return rows
    }
    catch (e: any) {
      if (e?.statusCode === 409 && attempt === 0) {
        continue
      }
      throw e
    }
  }
  throw createError({ statusCode: 409, statusMessage: 'Could not persist assigned row ids.' })
}

function assertUniqueIds(rows: Record<string, any>[], idField: string) {
  const seen = new Set<string>()
  for (const r of rows) {
    const id = r[idField]
    const key = String(id)
    if (seen.has(key)) {
      throw createError({
        statusCode: 422,
        statusMessage: `Duplicate ${idField} in file: ${key}`,
      })
    }
    seen.add(key)
  }
}

function buildArrayListColumns(cfg: JsonArrayResourceConfig) {
  const idKey = cfg.idField
  const columnTypes = zodToListSpec(cfg.elementSchema as any)
  const shape = cfg.elementSchema.shape
  const keys = Object.keys(shape).filter(k => k !== idKey)
  const fieldDefs = cfg.list.fields
  if (fieldDefs?.length) {
    return fieldDefs
      .map((def) => {
        if (typeof def === 'string') {
          return {
            id: def,
            accessorKey: def,
            header: cfg.fields?.find(f => f.name === def)?.label ?? toTitleCase(def),
            type: columnTypes[def]?.type,
            sortKey: cfg.list.enableSort ? def : undefined,
          }
        }
        return {
          id: def.field,
          accessorKey: def.field,
          header: def.label ?? toTitleCase(def.field),
          type: def.type ?? columnTypes[def.field]?.type,
          sortKey: cfg.list.enableSort ? (def.sortKey ?? def.field) : undefined,
        }
      })
      .filter(col => col.accessorKey !== idKey)
  }
  return keys.map(key => ({
    id: key,
    accessorKey: key,
    header: cfg.fields?.find(f => f.name === key)?.label ?? toTitleCase(key),
    type: columnTypes[key]?.type,
    sortKey: cfg.list.enableSort ? key : undefined,
  }))
}

export async function listJsonArrayRecords(cfg: JsonArrayResourceConfig, query: Record<string, any> = {}) {
  const rows = await readValidatedArrayRows(cfg)

  let filtered = rows
  const search = query.search
  if (cfg.list.enableSearch && search && cfg.list.searchFields?.length) {
    filtered = filtered.filter(r => rowMatchesSearch(r, String(search), cfg.list.searchFields!))
  }

  filtered = sortRows(filtered, query.ordering, cfg.list.enableSort)

  const pageSlice = paginateArray(filtered, query)

  const spec = {
    endpoint: cfg.list.endpoint,
    updatePage: cfg.update.enabled ? cfg.update.route : undefined,
    createPage: cfg.create.enabled ? cfg.create.route : undefined,
    deleteEndpoint: cfg.delete.enabled ? cfg.delete.endpoint : undefined,
    enableDelete: cfg.delete.enabled,
    bulkActions: [] as { label: string, icon?: string }[],
    title: cfg.list.title,
    showCreateButton: cfg.create.enabled && cfg.list.showCreateButton,
    enableSort: cfg.list.enableSort,
    enableSearch: cfg.list.enableSearch,
    searchPlaceholder: cfg.list.enableSearch ? cfg.list.searchPlaceholder : undefined,
    searchFields: cfg.list.enableSearch ? cfg.list.searchFields : undefined,
    columns: buildArrayListColumns(cfg),
    lookupColumnName: cfg.idField,
    sortField: undefined,
  }

  return {
    ...pageSlice,
    filters: undefined,
    spec,
  }
}

export async function getJsonArrayDetail(cfg: JsonArrayResourceConfig, lookupValue: string) {
  const decoded = decodeURIComponent(lookupValue)
  const rows = await readValidatedArrayRows(cfg)
  const row = rows.find(r => String(r[cfg.idField]) === decoded)
  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: `No row with ${cfg.idField}="${decoded}".`,
    })
  }
  return row
}

function preprocessDates(schema: ZodObject<Record<string, ZodType>>, inputData: Record<string, any>) {
  const preprocessed = { ...inputData }
  const shape = schema.shape
  for (const key in shape) {
    const fieldSchema = unwrapZodType(shape[key]!)
    if (fieldSchema.innerType.def.type === 'date' && typeof preprocessed[key] === 'string') {
      const maybeDate = new Date(preprocessed[key])
      if (!Number.isNaN(maybeDate.getTime())) {
        preprocessed[key] = maybeDate
      }
    }
  }
  return preprocessed
}

async function writeArrayWithRetry(
  cfg: JsonArrayResourceConfig,
  mutator: (rows: Record<string, any>[]) => Record<string, any>[],
  messageSuffix: string,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const repo = createJsonStorageRepository(cfg.storage, cfg.kind)
      const { parsed, revision } = await repo.read()
      if (!Array.isArray(parsed)) {
        throw createError({
          statusCode: 422,
          statusMessage: 'JSON root must be an array.',
        })
      }
      const rows = z.array(cfg.elementSchema).parse(parsed) as Record<string, any>[]
      ensureInternalRowIds(rows, cfg.idField)
      const next = mutator(rows)
      assertUniqueIds(next, cfg.idField)
      z.array(cfg.elementSchema).parse(next)
      await repo.write({
        bodyUtf8: `${JSON.stringify(next, null, 2)}\n`,
        revision,
        message: `${cfg.commitMessagePrefix}${messageSuffix}`,
      })
      return
    }
    catch (e: any) {
      if (e?.statusCode === 409 && attempt === 0) {
        continue
      }
      throw e
    }
  }
}

export async function createJsonArrayRecord(cfg: JsonArrayResourceConfig, data: any) {
  if (!cfg.create.enabled) {
    throw createError({ statusCode: 404, statusMessage: 'Create is disabled for this resource.' })
  }
  let created: Record<string, any> | undefined

  await writeArrayWithRetry(cfg, (rows) => {
    const input = typeof data === 'object' && data !== null ? { ...data } : {}
    delete input[cfg.idField]
    const preprocessed = preprocessDates(cfg.elementSchema, input)
    const validated = cfg.elementSchema.parse(preprocessed) as Record<string, any>
    const ids = new Set(rows.map(r => String(r[cfg.idField])))
    validated[cfg.idField] = crypto.randomUUID()
    if (ids.has(String(validated[cfg.idField]))) {
      throw createError({
        statusCode: 422,
        statusMessage: `${cfg.idField} collision (retry).`,
      })
    }
    created = validated
    return [...rows, validated]
  }, 'create row')

  return {
    success: true,
    message: `${cfg.key} created`,
    data: created,
  }
}

export async function updateJsonArrayRecord(cfg: JsonArrayResourceConfig, lookupValue: string, data: any) {
  if (!cfg.update.enabled) {
    throw createError({ statusCode: 404, statusMessage: 'Update is disabled for this resource.' })
  }
  const decoded = decodeURIComponent(lookupValue)
  let updated: Record<string, any> | undefined

  await writeArrayWithRetry(cfg, (rows) => {
    const idx = rows.findIndex(r => String(r[cfg.idField]) === decoded)
    if (idx === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: `No row with ${cfg.idField}="${decoded}".`,
      })
    }
    const input = typeof data === 'object' && data !== null ? { ...data } : {}
    delete input[cfg.idField]
    const preprocessed = preprocessDates(cfg.elementSchema, input)
    const merged = { ...rows[idx], ...preprocessed }
    if (String(merged[cfg.idField]) !== decoded) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Changing the id field is not supported.',
      })
    }
    const validated = cfg.elementSchema.parse(merged) as Record<string, any>
    updated = validated
    const next = [...rows]
    next[idx] = validated
    return next
  }, `update ${decoded}`)

  return {
    success: true,
    message: `${cfg.key} updated`,
    data: updated,
  }
}

export async function deleteJsonArrayRecord(cfg: JsonArrayResourceConfig, lookupValue: string) {
  if (!cfg.delete.enabled) {
    throw createError({ statusCode: 404, statusMessage: 'Delete is disabled for this resource.' })
  }
  const decoded = decodeURIComponent(lookupValue)

  await writeArrayWithRetry(cfg, rows => rows.filter(r => String(r[cfg.idField]) !== decoded), `delete ${decoded}`)

  return {
    success: true,
    message: `${cfg.key} ${decoded} deleted`,
  }
}

export async function bulkDeleteJsonArrayRecords(cfg: JsonArrayResourceConfig, rowLookups: (string | number)[]) {
  if (!cfg.delete.enabled) {
    throw createError({ statusCode: 404, statusMessage: 'Delete is disabled for this resource.' })
  }
  const remove = new Set(rowLookups.map(v => String(v)))

  await writeArrayWithRetry(cfg, rows => rows.filter(r => !remove.has(String(r[cfg.idField]))), `bulk delete (${rowLookups.length})`)

  return {
    success: true,
    message: `${rowLookups.length} rows deleted`,
  }
}

async function readValidatedObject(cfg: JsonObjectResourceConfig) {
  const repo = createJsonStorageRepository(cfg.storage, cfg.kind)
  const { parsed, revision } = await repo.read()
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'JSON file must contain a single object for this resource.',
    })
  }
  const raw = omitNullUndefinedShallow(parsed as Record<string, unknown>)
  const merged = mergeMissingJsonReadDefaults(cfg.schema, raw)
  const data = parseObjectSchemaOr422(cfg.schema, merged, jsonStorageSourceHint(cfg.storage))
  return { data, revision }
}

export async function getJsonObjectDetail(cfg: JsonObjectResourceConfig, lookupValue: string) {
  if (lookupValue !== JSON_OBJECT_LOOKUP) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid object resource path.',
    })
  }
  const { data } = await readValidatedObject(cfg)
  return data
}

export async function updateJsonObjectRecord(cfg: JsonObjectResourceConfig, lookupValue: string, data: any) {
  if (!cfg.update.enabled) {
    throw createError({ statusCode: 404, statusMessage: 'Update is disabled for this resource.' })
  }
  if (lookupValue !== JSON_OBJECT_LOOKUP) {
    throw createError({ statusCode: 404, statusMessage: 'Invalid object resource path.' })
  }
  let result: Record<string, any> | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const repo = createJsonStorageRepository(cfg.storage, cfg.kind)
      const { revision } = await repo.read()
      const input = typeof data === 'object' && data !== null
        ? omitNullUndefinedShallow({ ...data } as Record<string, unknown>)
        : {}
      const preprocessed = preprocessDates(cfg.schema, input)
      const validated = parseObjectSchemaOr422(
        cfg.schema,
        preprocessed as Record<string, unknown>,
        jsonStorageSourceHint(cfg.storage),
      )
      result = validated
      await repo.write({
        bodyUtf8: `${JSON.stringify(validated, null, 2)}\n`,
        revision,
        message: `${cfg.commitMessagePrefix}update object`,
      })
      break
    }
    catch (e: any) {
      if (e?.statusCode === 409 && attempt === 0) {
        continue
      }
      throw e
    }
  }
  return {
    success: true,
    message: `${cfg.key} updated`,
    data: result,
  }
}

export function assertJsonResourceSupportsList(cfg: JsonResourceConfig): asserts cfg is JsonArrayResourceConfig {
  if (cfg.kind !== 'array') {
    throw createError({
      statusCode: 400,
      statusMessage: 'This operation is only available for array JSON resources.',
    })
  }
}
