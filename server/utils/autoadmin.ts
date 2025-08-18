import type { AdminModelConfig } from '#layers/autoadmin/server/utils/registry'
import type { Table } from 'drizzle-orm'
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { getLabelColumnFromColumns } from '#layers/autoadmin/utils/autoadmin'
import { getTableColumns } from 'drizzle-orm'

export function getModelConfig(modelKey: string): AdminModelConfig {
  const registry = useAdminRegistry()
  const cfg = registry.get(modelKey)
  if (!cfg) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model "${modelKey}" is not registered.`,
    })
  }
  return cfg
}

export function getLabelColumnFromModel(model: Table) {
  // find the model in registry
  const registry = useAdminRegistry()
  const cfg = registry.all().find(cfg => cfg.model === model)
  if (cfg?.labelColumnName) {
    return cfg.labelColumnName
  }
  // else find from columns
  const modelColumns = getTableColumns(model)
  return getLabelColumnFromColumns(modelColumns)
}

export function getEnabledStatuses(model: Table) {
  const registry = useAdminRegistry().map()
  for (const [key, cfg] of registry) {
    if (cfg.model === model) {
      return {
        key,
        create: cfg.create.enabled,
        update: cfg.update.enabled,
      }
    }
  }
}
