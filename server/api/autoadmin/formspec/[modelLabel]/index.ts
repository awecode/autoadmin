import { createInsertSchema } from 'drizzle-zod'
import { useAdminRegistry } from '~/composables/registry'
import { useDefinedFields, zodToFormSpec } from '~/server/utils/form'
import { useMetadataOnFormSpec } from '~/server/utils/metdata'
import { addForeignKeysToFormSpec, addM2mRelationsToFormSpec, addO2mRelationsToFormSpec, getTableForeignKeys, parseM2mRelations } from '~/server/utils/relation'

export default defineEventHandler(async (event) => {
  const modelLabel = getRouterParam(event, 'modelLabel')
  if (!modelLabel) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model label is required.',
    })
  }
  const cfg = useAdminRegistry().get(modelLabel)
  if (!cfg) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} not registered.`,
    })
  }
  if (!cfg.create.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow creation.`,
    })
  }
  const model = cfg.model
  const insertSchema = createInsertSchema(model)
  const spec = zodToFormSpec(insertSchema as any)
  if (cfg.update.formFields || cfg.fields) {
    spec.fields = useDefinedFields(spec, cfg)
  }
  const foreignKeys = getTableForeignKeys(model)
  const specWithForeignKeys = await addForeignKeysToFormSpec(spec, cfg, foreignKeys)

  const specWithO2mRelations = cfg.o2m ? await addO2mRelationsToFormSpec(specWithForeignKeys, cfg) : specWithForeignKeys

  const m2mRelations = cfg.m2m ? parseM2mRelations(cfg.model, cfg.m2m) : []
  const specWithM2mRelations = await addM2mRelationsToFormSpec(specWithO2mRelations, cfg, m2mRelations)

  const specWithMetadata = await useMetadataOnFormSpec(specWithM2mRelations, cfg.metadata)
  specWithMetadata.warnOnUnsavedChanges = cfg.create.warnOnUnsavedChanges
  return {
    spec: specWithMetadata,
  }
})
