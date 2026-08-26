import type { Column } from 'drizzle-orm'

export function getAdminTitle() {
  const config = useRuntimeConfig()
  if (config.public.autoadmin?.title) {
    return config.public.autoadmin.title
  }
  return 'AutoAdmin'
}

export function getLabelColumnFromColumns(columns: Record<string, Column>) {
  const columnNames = Object.keys(columns)
  if (!columnNames.length) {
    throw new Error(`No columns found for the model.`)
  }
  const labelColumnNames = columnNames.filter(column => ['name', 'title', 'label', 'slug'].includes(column))
  if (labelColumnNames.length) {
    return labelColumnNames[0]!
  }
  // else return the first column
  return columnNames[0]!
}

/**
 * Encode list filter query the same way as Filters.vue / DataTable (`key:value;...`).
 */
export function encodeAutoadminListFilters(filters: Record<string, string>): string {
  return Object.entries(filters)
    .map(([key, val]) => `${key}:${String(val).replaceAll(';', '%3B')}`)
    .join(';')
}
