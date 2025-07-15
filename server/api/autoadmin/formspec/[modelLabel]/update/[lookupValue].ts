import type { ColKey } from '#layers/autoadmin/composables/useAdminRegistry'
import type { Table } from 'drizzle-orm'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { zodToFormSpec } from '#layers/autoadmin/utils/form'
import { useMetadataOnFormSpec } from '#layers/autoadmin/utils/metdata'
import { addForeignKeysToFormSpec, addM2mRelationsToFormSpec, addO2mRelationsToFormSpec, getTableForeignKeys, parseM2mRelations } from '#layers/autoadmin/utils/relation'
import { eq } from 'drizzle-orm'

const getTableValues = async (cfg: AdminModelConfig<Table>, spec: FormSpec, lookupValue: string) => {
  const db = useDb()
  const model = cfg.model
  const lookupColumn = cfg.lookupColumn
  const columns = spec.fields.map(field => field.name as ColKey<typeof model>)

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
  return {
    spec: specWithMetadata,
  }
})
