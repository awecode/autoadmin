import type { ColKey } from '#layers/autoadmin/composables/registry'
import type { Table } from 'drizzle-orm'
import { useAdminRegistry } from '#layers/autoadmin/composables/registry'
import { useDefinedFields, zodToFormSpec } from '#layers/autoadmin/utils/form'
import { useMetadataOnFormSpec } from '#layers/autoadmin/utils/metdata'
import { addForeignKeysToFormSpec, addM2mRelationsToFormSpec, addO2mRelationsToFormSpec, getTableForeignKeys, parseM2mRelations } from '#layers/autoadmin/utils/relation'
import { eq } from 'drizzle-orm'

const getTableValues = async (cfg: AdminModelConfig<Table>, spec: FormSpec, lookupValue: string) => {
  const db = useDb()
  const model = cfg.model
  const lookupColumn = cfg.lookupColumn
  const columns = spec.fields.map(field => field.name as ColKey<typeof model>)

  // Add label column to select because we need it for the label string in update page header, even if it is not included in form fields
  const labelColumnName = cfg.labelColumnName
  if (labelColumnName && !columns.includes(labelColumnName)) {
    columns.push(labelColumnName)
  }

  const selectObj = Object.fromEntries(
    columns.map(colName => [colName, cfg.columns[colName]]),
  )

  const result = await db
    .select(selectObj)
    .from(model)
    .where(eq(lookupColumn, lookupValue))
  const values = result[0]
  return values
}

export default defineEventHandler(async (event) => {
  const modelLabel = getRouterParam(event, 'modelLabel')
  if (!modelLabel) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model label is required.',
    })
  }
  const lookupValue = getRouterParam(event, 'lookupValue')
  if (!lookupValue) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Lookup value is required.',
    })
  }
  const cfg = useAdminRegistry().get(modelLabel)
  if (!cfg) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} not registered.`,
    })
  }
  if (!cfg.update.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow updates.`,
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
  return {
    spec: specWithMetadata,
  }
})
