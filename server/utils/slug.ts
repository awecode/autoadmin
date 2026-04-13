import type { AdminModelConfig } from '#layers/autoadmin/server/utils/registry'
import type { Column, Table } from 'drizzle-orm'
import { and, eq, like, ne, or } from 'drizzle-orm'
import { useAdminDb } from './db'

/**
 * Extracts the column name from a unique constraint DB error.
 * Returns undefined if the error is not a unique constraint violation.
 */
export function getUniqueViolationColumn(error: any): string | undefined {
  const cause = error.cause ?? error
  const code = cause?.code ?? error.code
  if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const fullMessage = cause?.message ?? error.message ?? ''
    return fullMessage.split(' ').at(-1)?.split('.')[1]
  }
  if (code === '23505') {
    return cause?.column ?? cause?.detail?.match(/\(([^)]+)\)=/)?.[1]
  }
  if (code === 'ER_DUP_ENTRY') {
    return cause?.column
  }
  return undefined
}

/**
 * Returns true if the error is a unique constraint violation on a slug field
 * and auto-unique slugs are enabled.
 */
export function isSlugUniqueViolation<T extends Table>(
  cfg: AdminModelConfig<T>,
  error: any,
): boolean {
  const config = useRuntimeConfig()
  if (config.autoadmin?.autoUniqueSlugs === false)
    return false
  if (!cfg.slugFields)
    return false

  const column = getUniqueViolationColumn(error)
  return !!column && column in cfg.slugFields
}

/**
 * For each slug field in cfg.slugFields, ensures the value in `data` is unique
 * by appending -1, -2, etc. if a collision exists.
 * When `excludeLookupValue` is provided (update mode), the current record is
 * excluded from the uniqueness check.
 */
export async function ensureUniqueSlugs<T extends Table>(
  cfg: AdminModelConfig<T>,
  data: Record<string, any>,
  excludeLookupValue?: string,
) {
  if (!cfg.slugFields)
    return

  const db = useAdminDb()

  for (const slugFieldName of Object.keys(cfg.slugFields)) {
    const slug = data[slugFieldName]
    if (typeof slug !== 'string' || slug === '')
      continue

    const column = cfg.columns[slugFieldName] as Column | undefined
    if (!column)
      continue

    const escapedSlug = slug.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const conditions = [
      or(
        eq(column, slug),
        like(column, `${escapedSlug}-%`),
      ),
    ]

    if (excludeLookupValue) {
      conditions.push(ne(cfg.lookupColumn, excludeLookupValue))
    }

    const rows = await (db as any)
      .select({ val: column })
      .from(cfg.model)
      .where(and(...conditions))

    const existing = new Set<string>(rows.map((r: any) => r.val))

    if (!existing.has(slug))
      continue

    let suffix = 1
    while (existing.has(`${slug}-${suffix}`)) {
      suffix++
    }
    data[slugFieldName] = `${slug}-${suffix}`
  }
}
