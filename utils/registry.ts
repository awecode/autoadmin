import type { Table } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'

type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

export function getLabelColumnFromModel<T extends Table>(model: T): ColKey<T> {
  const columns = getTableColumns(model)
  if (!columns) {
    throw new Error(`No columns found for model ${model._.name}`)
  }
  // TODO: find if there is a column with the name 'name', 'title', 'label', 'slug', return the first one found
  const labelColumns = Object.keys(columns).filter(column => ['name', 'title', 'label', 'slug'].includes(column))
  if (labelColumns.length) {
    return labelColumns[0] as ColKey<T>
  }
  // return the first column
  return Object.keys(columns)[0] as ColKey<T>
}
