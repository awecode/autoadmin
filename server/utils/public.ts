import type { Table } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { AdminModelOptions } from './registry'
import { getQuery } from 'h3'
import { listRecords } from '../services/list'
import { useAdminRegistry } from './registry'

/**
 * Transforms an object by grouping fields with the pattern {prefix}__{field} into nested objects.
 * For example: { issueId__issue: 12, issueId__volume: 1 } becomes { issue: { issue: 12, volume: 1 } }
 * The prefix is normalized by removing 'Id' suffix if present (e.g., 'issueId' -> 'issue').
 *
 * @param input - The object or array of objects to transform
 * @returns The transformed object(s) with nested objects for grouped fields
 */
function groupNestedFields(
  input: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
) {
  // Handle null/undefined
  if (input == null) {
    return input
  }

  // Handle arrays
  if (Array.isArray(input)) {
    return input.map(item => transformItem(item))
  }

  // Handle single object
  return transformItem(input)
}

/**
 * Transforms a single object by grouping fields with the pattern {prefix}__{field} into nested objects.
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

        // Initialize the nested object if it doesn't exist
        if (!groupedFields.has(normalizedPrefix)) {
          groupedFields.set(normalizedPrefix, {})
        }

        // Add the field to the nested object
        const nestedObj = groupedFields.get(normalizedPrefix)!
        nestedObj[field] = item[key]

        // Mark this key to skip in the second pass
        keysToSkip.add(key)
      }
    }
  }

  // Second pass: copy non-nested fields to result
  for (const key in item) {
    if (!keysToSkip.has(key)) {
      result[key] = item[key]
    }
  }

  // Add all grouped nested objects to the result
  for (const [prefix, nestedObj] of groupedFields.entries()) {
    if (Object.keys(nestedObj).length > 0) {
      result[prefix] = nestedObj
    }
  }

  return result
}

export async function publicListRecords<T extends Table>(model: T, options: AdminModelOptions<T>, event: H3Event) {
  const cfg = useAdminRegistry().configure(model, options)
  const result = await listRecords(cfg, getQuery(event), false)

  result.results = groupNestedFields(result.results)
  return result
}
