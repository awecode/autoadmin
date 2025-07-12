import type { Column } from 'drizzle-orm'

export function getLabelColumnFromModel(columns: Record<string, Column>) {
  if (!columns) {
    throw new Error(`No columns found for the model.`)
  }
  const labelColumns = Object.keys(columns).filter(column => ['name', 'title', 'label', 'slug'].includes(column))
  if (labelColumns.length) {
    return labelColumns[0]
  }
  // else return the first column
  return Object.keys(columns)[0]
}
