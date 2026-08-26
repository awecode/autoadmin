import type { FieldType } from '#layers/autoadmin/server/utils/registry'
import { zodToFormSpec } from '#layers/autoadmin/server/utils/form'
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { createInsertSchema } from 'drizzle-zod'

export type AuditFieldMeta = {
  type: FieldType
  label: string
}

/**
 * Resolve display type + label for each column of a registered model.
 * Uses the same zod + cfg.fields sources as formspec (without create permission).
 */
export function getAuditFieldMeta(modelKey: string): Record<string, AuditFieldMeta> {
  const cfg = useAdminRegistry().get(modelKey)
  if (!cfg) {
    return {}
  }

  const insertSchema = createInsertSchema(cfg.model)
  const spec = zodToFormSpec(insertSchema)
  const result: Record<string, AuditFieldMeta> = {}

  for (const field of spec.fields) {
    const override = cfg.fields?.find(f => f.name === field.name)
    let type: FieldType = override?.type || field.type
    if (
      cfg.metadata.datetimeColumns.includes(field.name)
      || cfg.metadata.autoTimestampColumns.includes(field.name)
    ) {
      type = 'datetime-local'
    }
    result[field.name] = {
      type,
      label: override?.label || field.label || toTitleCase(field.name),
    }
  }

  for (const override of cfg.fields ?? []) {
    if (!override.name) {
      continue
    }
    const existing = result[override.name]
    let type: FieldType = override.type || existing?.type || 'text'
    if (
      cfg.metadata.datetimeColumns.includes(override.name)
      || cfg.metadata.autoTimestampColumns.includes(override.name)
    ) {
      type = 'datetime-local'
    }
    result[override.name] = {
      type,
      label: override.label || existing?.label || toTitleCase(override.name),
    }
  }

  for (const name of [
    ...cfg.metadata.datetimeColumns,
    ...cfg.metadata.autoTimestampColumns,
  ]) {
    if (!result[name]) {
      result[name] = {
        type: 'datetime-local',
        label: toTitleCase(name),
      }
    }
    else {
      result[name]!.type = 'datetime-local'
    }
  }

  return result
}
