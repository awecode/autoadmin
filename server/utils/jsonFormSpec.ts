import type { FormSpec } from '#layers/autoadmin/server/utils/form'
import type { JsonArrayResourceConfig, JsonObjectResourceConfig } from '#layers/autoadmin/server/utils/jsonResourceRegistry'
import { getJsonArrayDetail, getJsonObjectDetail } from '#layers/autoadmin/server/services/jsonResourceCrud'
import { useDefinedFieldsJson, zodToFormSpec } from '#layers/autoadmin/server/utils/form'
import { JSON_OBJECT_LOOKUP } from '#layers/autoadmin/server/utils/jsonResourceRegistry'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { zerialize } from 'zodex'

function jsonFormFieldSource(cfg: JsonArrayResourceConfig | JsonObjectResourceConfig) {
  if (cfg.kind === 'array') {
    return { fields: cfg.fields, create: cfg.create, update: cfg.update }
  }
  return { fields: cfg.fields, create: undefined, update: cfg.update }
}

export async function buildJsonArrayCreateFormSpec(cfg: JsonArrayResourceConfig, modelKey: string): Promise<FormSpec> {
  const spec = zodToFormSpec(cfg.elementSchema)
  spec.fields = useDefinedFieldsJson(spec, jsonFormFieldSource(cfg), 'create')
  spec.warnOnUnsavedChanges = cfg.create.warnOnUnsavedChanges
  const apiPrefix = cfg.apiPrefix
  spec.endpoint = cfg.create.endpoint ?? `${apiPrefix}/${modelKey}`
  spec.listTitle = cfg.list.title ?? cfg.label
  spec.schema = zerialize(cfg.elementSchema)
  return spec
}

export async function buildJsonArrayUpdateFormSpec(cfg: JsonArrayResourceConfig, modelKey: string, lookupValue: string): Promise<FormSpec> {
  const spec = zodToFormSpec(cfg.elementSchema)
  const values = await getJsonArrayDetail(cfg, lookupValue)
  spec.values = values
  spec.fields = useDefinedFieldsJson(spec, jsonFormFieldSource(cfg), 'update')
  spec.warnOnUnsavedChanges = cfg.update.warnOnUnsavedChanges
  const labelField = cfg.labelField
  if (spec.values && labelField in spec.values) {
    spec.labelString = String(spec.values[labelField])
    if (!spec.fields.some(f => f.name === labelField)) {
      delete spec.values[labelField]
    }
  }
  spec.values = Object.fromEntries(
    Object.entries(spec.values!).filter(([key]) => spec.fields.some(f => f.name === key)),
  )
  const apiPrefix = cfg.apiPrefix
  spec.endpoint = cfg.update.endpoint ?? `${apiPrefix}/${modelKey}/${encodeURIComponent(lookupValue)}`
  spec.listTitle = cfg.list.title ?? cfg.label
  spec.schema = zerialize(cfg.elementSchema)
  return spec
}

export async function buildJsonObjectUpdateFormSpec(cfg: JsonObjectResourceConfig, modelKey: string): Promise<FormSpec> {
  const spec = zodToFormSpec(cfg.schema)
  const values = await getJsonObjectDetail(cfg, JSON_OBJECT_LOOKUP)
  spec.values = values
  spec.fields = useDefinedFieldsJson(spec, jsonFormFieldSource(cfg), 'update')
  spec.warnOnUnsavedChanges = cfg.update.warnOnUnsavedChanges
  const firstTitleKey = spec.fields[0]?.name
  if (firstTitleKey && spec.values && firstTitleKey in spec.values) {
    spec.labelString = String(spec.values[firstTitleKey])
  }
  else {
    spec.labelString = toTitleCase(modelKey)
  }
  spec.values = Object.fromEntries(
    Object.entries(spec.values!).filter(([key]) => spec.fields.some(f => f.name === key)),
  )
  const apiPrefix = cfg.apiPrefix
  spec.endpoint = cfg.update.endpoint ?? `${apiPrefix}/${modelKey}/${JSON_OBJECT_LOOKUP}`
  spec.listTitle = cfg.label
  spec.schema = zerialize(cfg.schema)
  return spec
}
