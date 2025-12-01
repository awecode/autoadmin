import type { Table } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { AdminModelOptions } from './registry'
import { getQuery } from 'h3'
import { listRecords } from '../services/list'
import { useAdminRegistry } from './registry'

/**
 * Utility Type: PathToObject
 * Recursively transforms a dot-notation string (e.g., "a.b.c") into a nested object type.
 * Default leaf value is 'any' to accommodate DB record types (string, number, date, etc).
 */
type PathToObject<P extends string, Value = any> = P extends `${infer Key}Id.${infer Rest}`
  ? { [K in Key]: PathToObject<Rest, Value> }
  : { [K in P]: Value }

/**
 * Utility Type: DeepMerge
 * Deeply merges two object types.
 */
type DeepMerge<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T | keyof U]: K extends keyof T
          ? K extends keyof U
            ? DeepMerge<T[K], U[K]>
            : T[K]
          : K extends keyof U
            ? U[K]
            : never;
      }
    : U
  : U

/**
 * Utility Type: TupleToObject
 * Converts a tuple of dot-notation strings into a deeply nested object type.
 */
type TupleToObject<T extends readonly string[]> = T extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends string
    ? Tail extends readonly string[]
      ? DeepMerge<PathToObject<Head>, TupleToObject<Tail>>
      : PathToObject<Head>
    : object
  : object

/**
 * Transforms a single object by grouping fields with the pattern {prefix}__{field}.
 * Normalizes 'prefixId' -> 'prefix'.
 */
function transformItem<T extends Table | Record<string, unknown>>(item: T) {
  const result: T | Record<string, unknown> = {}
  const groupedFields = new Map<string, Record<string, unknown>>()
  const keysToSkip = new Set<string>()

  // First pass: identify and group nested fields
  for (const key in item) {
    if (key.includes('__')) {
      const [prefix, field] = key.split('__', 2)
      if (prefix && field) {
        // Normalize prefix: remove 'Id' suffix if present (e.g., 'issueId' -> 'issue')
        const normalizedPrefix = prefix.endsWith('Id') ? prefix.slice(0, -2) : prefix

        // Initialize nested object
        if (!groupedFields.has(normalizedPrefix)) {
          groupedFields.set(normalizedPrefix, {})
        }

        // Add field to nested object
        const nestedObj = groupedFields.get(normalizedPrefix)!
        nestedObj[field] = item[key]

        keysToSkip.add(key)
      }
    }
  }

  // Second pass: copy non-nested fields
  for (const key in item) {
    if (!keysToSkip.has(key)) {
      result[key] = item[key]
    }
  }

  // Merge grouped objects into result
  for (const [prefix, nestedObj] of groupedFields.entries()) {
    if (Object.keys(nestedObj).length > 0) {
      result[prefix] = nestedObj
    }
  }

  return result
}

export async function publicListRecords<
  T extends Table,
  const TFields extends readonly string[], // Capture fields as literals for Type Inference
>(model: T, options: AdminModelOptions<T> & { list?: { fields?: TFields } }, event: H3Event) {
  const cfg = useAdminRegistry().configure(model, options)
  const result = await listRecords(cfg, getQuery(event), false)
  const transformedResults = result.results.map(item => transformItem(item)) as TupleToObject<TFields>[]
  return {
    ...result,
    results: transformedResults,
  }
}
