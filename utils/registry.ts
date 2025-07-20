import type { Column, Table } from 'drizzle-orm'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { getTableColumns } from 'drizzle-orm'

export function getLabelColumnFromColumns(columns: Record<string, Column>) {
  if (!columns) {
    throw new Error(`No columns found for the model.`)
  }
  const columnNames = Object.keys(columns).filter(column => ['name', 'title', 'label', 'slug'].includes(column))
  if (columnNames.length) {
    return columnNames[0]
  }
  // else return the first column
  return Object.keys(columns)[0]
}

export function getLabelColumnFromModel(model: Table) {
  // find the model in registry
  const registry = useAdminRegistry()
  const modelConfig = registry.all().find(cfg => cfg.model === model)
  if (modelConfig?.labelColumnName) {
    return modelConfig.labelColumnName
  }
  // else find from columns
  const modelColumns = getTableColumns(model)
  return getLabelColumnFromColumns(modelColumns)
}

export function getEnabledStatuses(model: Table) {
  const registry = useAdminRegistry().map()
  for (const [key, obj] of registry) {
    if (obj.model === model) {
      return {
        key,
        create: obj.create.enabled,
        update: obj.update.enabled,
      }
    }
  }
}
