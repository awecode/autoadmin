import type { Column, Table } from 'drizzle-orm'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { getTableColumns } from 'drizzle-orm'

export function getLabelColumnFromColumns(columns: Record<string, Column>) {
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

export function getLabelColumnFromModel(model: Table) {
  // find the model in registry
  const registry = useAdminRegistry()
  const modelConfig = registry.all().find(cfg => cfg.model === model)
  if (modelConfig?.labelColumn) {
    return modelConfig.labelColumn
  }
  // else find from columns
  const modelColumns = getTableColumns(model)
  return getLabelColumnFromColumns(modelColumns)
}
