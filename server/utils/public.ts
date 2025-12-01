import type { Table } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { AdminModelOptions } from './registry'
import { getQuery } from 'h3'
import { listRecords } from '../services/list'
import { useAdminRegistry } from './registry'

/**
 * Utility Type: Prettify
 * Collapses complex intersection types into a clean, readable object structure.
 */
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {}

/**
 * Utility Type: PathToObject
 * Recursively transforms a dot-notation string (e.g., "a.b.c")
 * into a nested object type.
 * Default leaf value is 'any' to accommodate DB record types (string, number, date, etc).
 */
type PathToObject<P extends string, Value = any> = P extends `${infer Key}.${infer Rest}`
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
    : {}
  : {}

// ==========================================
// Runtime Logic (Your Implementation)
// ==========================================

/**
 * Transforms a single object by grouping fields with the pattern {prefix}__{field}.
 * Normalizes 'prefixId' -> 'prefix'.
 */
function transformItem(item: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
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

/**
 * Generic Overloads for groupNestedFields
 * Passing the 'fields' array as the second argument triggers the type inference.
 */

// Overload 1: Array Input with Schema
export function groupNestedFields<const TFields extends readonly string[]>(
  input: Array<Record<string, unknown>>,
  fieldsSchema: TFields
): Prettify<TupleToObject<TFields>>[]

// Overload 2: Single Object Input with Schema
export function groupNestedFields<const TFields extends readonly string[]>(
  input: Record<string, unknown>,
  fieldsSchema: TFields
): Prettify<TupleToObject<TFields>>

// Overload 3: Array Input (No Schema - returns any[])
export function groupNestedFields(
  input: Array<Record<string, unknown>>
): Array<Record<string, unknown>>

// Overload 4: Single Object Input (No Schema - returns any)
export function groupNestedFields(
  input: Record<string, unknown>
): Record<string, unknown>

// Overload 5: Null/Undefined
export function groupNestedFields(input: null | undefined): null | undefined

/**
 * Implementation
 */
export function groupNestedFields(
  input: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
  _fieldsSchema?: readonly string[], // Unused at runtime, specifically for Type Inference
) {
  if (input == null) return input

  if (Array.isArray(input)) {
    return input.map(item => transformItem(item))
  }

  return transformItem(input)
}

export async function publicListRecords<
  T extends Table,
  const TFields extends readonly string[], // Capture fields as literals for Type Inference
>(model: T, options: AdminModelOptions<T> & { list?: { fields?: TFields } }, event: H3Event) {
  const cfg = useAdminRegistry().configure(model, options)
  const result = await listRecords(cfg, getQuery(event), false)

  const transformedResults = groupNestedFields(result.results, options.list?.fields)
  return {
    ...result,
    results: transformedResults,
  }
}
