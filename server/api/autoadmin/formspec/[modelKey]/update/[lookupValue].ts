import type { Table } from 'drizzle-orm'
import { getModelConfig } from '#layers/autoadmin/server/utils/autoadmin'
import { useDefinedFields, zodToFormSpec } from '#layers/autoadmin/server/utils/form'
import { useMetadataOnFormSpec } from '#layers/autoadmin/server/utils/metdata'
import { addForeignKeysToFormSpec, addM2mRelationsToFormSpec, addO2mRelationsToFormSpec, getTableForeignKeys, parseM2mRelations } from '#layers/autoadmin/server/utils/relation'
import { eq } from 'drizzle-orm'
import { zerialize } from 'zodex'

const getTableValues = async (cfg: AdminModelConfig<Table>, spec: FormSpec, lookupValue: string) => {
  const db = useAdminDb()
  const model = cfg.model
  const lookupColumn = cfg.lookupColumn
  const columns = spec.fields.map(field => field.name)

  // Add label column to select because we need it for the label string in update page header, even if it is not included in form fields
  const labelColumnName = cfg.labelColumnName
  if (labelColumnName && !columns.includes(labelColumnName)) {
    columns.push(labelColumnName)
  }

  const selectObj = Object.fromEntries(
    columns
      .filter(colName => colName in cfg.columns)
      .map(colName => [colName, cfg.columns[colName]!]),
  )

  const result = await db
    .select(selectObj)
    .from(model)
    .where(eq(lookupColumn, lookupValue))
  const values = result[0]
  return values
}

export default defineEventHandler(async (event) => {
  const modelKey = getRouterParam(event, 'modelKey')
  if (!modelKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model key is required.',
    })
  }
  const lookupValue = getRouterParam(event, 'lookupValue')
  if (!lookupValue) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Lookup value is required.',
    })
  }
  const cfg = getModelConfig(modelKey)
  if (!cfg.update.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model "${modelKey}" does not allow updates.`,
    })
  }
  const model = cfg.model
  const spec = zodToFormSpec(cfg.update.schema as any)
  if (cfg.update.formFields || cfg.fields) {
    spec.fields = useDefinedFields(spec, cfg)
  }
  spec.values = await getTableValues(cfg, spec, lookupValue)

  const foreignKeys = getTableForeignKeys(model)
  const specWithForeignKeys = await addForeignKeysToFormSpec(spec, cfg, foreignKeys)

  let specWithO2mRelations: FormSpec
  if (cfg.o2m) {
    specWithO2mRelations = await addO2mRelationsToFormSpec(specWithForeignKeys, cfg)
  } else {
    specWithO2mRelations = specWithForeignKeys
  }

  const m2mRelations = cfg.m2m ? parseM2mRelations(cfg.model, cfg.m2m) : []
  const specWithM2mRelations = await addM2mRelationsToFormSpec(specWithO2mRelations, cfg, m2mRelations)

  const specWithMetadata = await useMetadataOnFormSpec(specWithM2mRelations, cfg.metadata)
  specWithMetadata.warnOnUnsavedChanges = cfg.update.warnOnUnsavedChanges

  const labelColumnName = cfg.labelColumnName
  if (specWithMetadata.values && labelColumnName in specWithMetadata.values) {
    specWithMetadata.labelString = specWithMetadata.values[labelColumnName]
    // Now remove the label column from the spec values if it is not included in form fields
    if (!specWithMetadata.fields.some(field => field.name === labelColumnName)) {
      delete specWithMetadata.values[labelColumnName]
    }
  }
  const config = useRuntimeConfig()
  const apiPrefix = config.public.apiPrefix
  specWithMetadata.endpoint = cfg.update.endpoint ?? `${apiPrefix}/${modelKey}/${lookupValue}`
  specWithMetadata.listTitle = cfg.list.title ?? cfg.label
  specWithMetadata.schema = zerialize(cfg.update.schema)

  return {
    spec: specWithMetadata,
  }
})
