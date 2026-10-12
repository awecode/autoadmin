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

export function reservedSlugSet(reservedSlugs: string[] | undefined): Set<string> {
  return new Set((reservedSlugs ?? []).map(s => s.toLowerCase()))
}

/**
 * Reserved slugs for one field of one record. The slug the record already has
 * (`currentValue`) is left out, so existing rows keep it.
 */
export function reservedSlugsFor(reserved: Set<string>, currentValue?: unknown): Set<string> {
  if (typeof currentValue !== 'string' || !reserved.has(currentValue.toLowerCase()))
    return reserved
  const copy = new Set(reserved)
  copy.delete(currentValue.toLowerCase())
  return copy
}

/** First of `slug`, `slug-1`, `slug-2`, … that is neither taken nor reserved. */
export function nextAvailableSlug(slug: string, taken: Set<string>, reserved: Set<string>): string {
  const isFree = (value: string) => !taken.has(value) && !reserved.has(value.toLowerCase())
  if (isFree(slug))
    return slug
  let suffix = 1
  while (!isFree(`${slug}-${suffix}`)) {
    suffix++
  }
  return `${slug}-${suffix}`
}

/**
 * Checks slug values against `cfg.reservedSlugs` before saving. A reserved
 * value gets a suffix like a taken slug, or a validation error when
 * auto-unique slugs are disabled. Pass `currentRecord` on update so an
 * unchanged slug is left alone.
 */
export async function avoidReservedSlugs<T extends Table>(
  cfg: AdminModelConfig<T>,
  data: Record<string, any>,
  excludeLookupValue?: string,
  currentRecord?: Record<string, unknown>,
) {
  if (!cfg.slugFields || !cfg.reservedSlugs?.length)
    return

  const reserved = reservedSlugSet(cfg.reservedSlugs)
  const hit = Object.keys(cfg.slugFields).find((name) => {
    const slug = data[name]
    return typeof slug === 'string' && slug !== '' && reservedSlugsFor(reserved, currentRecord?.[name]).has(slug.toLowerCase())
  })
  if (!hit)
    return

  if (useRuntimeConfig().autoadmin?.autoUniqueSlugs === false) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: {
        message: `The ${hit} "${data[hit]}" is reserved.`,
        errors: [{ name: hit, message: 'This value is reserved and cannot be used.' }],
      },
    })
  }

  await ensureUniqueSlugs(cfg, data, excludeLookupValue, currentRecord)
}

/**
 * For each slug field in cfg.slugFields, ensures the value in `data` is unique
 * and not reserved by appending -1, -2, etc.
 * When `excludeLookupValue` is provided (update mode), the current record is
 * excluded from the uniqueness check.
 */
export async function ensureUniqueSlugs<T extends Table>(
  cfg: AdminModelConfig<T>,
  data: Record<string, any>,
  excludeLookupValue?: string,
  currentRecord?: Record<string, unknown>,
) {
  if (!cfg.slugFields)
    return

  const db = await useAdminDb()
  const reserved = reservedSlugSet(cfg.reservedSlugs)

  for (const slugFieldName of Object.keys(cfg.slugFields)) {
    const slug = data[slugFieldName]
    if (typeof slug !== 'string' || slug === '')
      continue

    const fieldReserved = reservedSlugsFor(reserved, currentRecord?.[slugFieldName])

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
    data[slugFieldName] = nextAvailableSlug(slug, existing, fieldReserved)
  }
}
