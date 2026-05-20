/** Matches URL `?sort=` and `list.defaultOrdering` (e.g. `publishedAt:desc`). */
export type ListOrdering = `${string}:asc` | `${string}:desc`

const ORDERING_RE = /^(.+):(asc|desc)$/

export function parseListOrdering(value: string): { accessorKey: string, direction: 'asc' | 'desc' } | null {
  const match = ORDERING_RE.exec(value)
  if (!match) {
    return null
  }
  return { accessorKey: match[1]!, direction: match[2]! as 'asc' | 'desc' }
}

export function assertValidListOrdering(value: string, label: string): void {
  if (!parseListOrdering(value)) {
    throw new Error(
      `${label} must be "accessorKey:asc" or "accessorKey:desc" (same format as the list URL ?sort= parameter).`,
    )
  }
}

/**
 * User `?sort=` wins; otherwise `defaultOrdering` when header sort is enabled and drag-drop is off.
 */
export function resolveListOrdering(
  queryOrdering: unknown,
  defaultOrdering: string | undefined,
  options: { enableSort: boolean, hasSortField: boolean },
): string | undefined {
  if (typeof queryOrdering === 'string' && queryOrdering.length > 0) {
    return queryOrdering
  }
  if (options.enableSort && !options.hasSortField && defaultOrdering) {
    return defaultOrdering
  }
  return undefined
}
