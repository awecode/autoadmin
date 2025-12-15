import { getModelConfig } from '#layers/autoadmin/server/utils/autoadmin'
import { useDefinedFields, zodToFormSpec } from '#layers/autoadmin/server/utils/form'
import { useMetadataOnFormSpec } from '#layers/autoadmin/server/utils/metdata'
import { addForeignKeysToFormSpec, addM2mRelationsToFormSpec, addO2mRelationsToFormSpec, getTableForeignKeys, parseM2mRelations } from '#layers/autoadmin/server/utils/relation'
import { createInsertSchema } from 'drizzle-zod'
import { zerialize } from 'zodex'

export default defineEventHandler(async (event) => {
  const modelKey = getRouterParam(event, 'modelKey')
  if (!modelKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model key is required.',
    })
  }
  const cfg = getModelConfig(modelKey)
  if (!cfg.create.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelKey} does not allow creation.`,
    })
  }
  const model = cfg.model
  const insertSchema = createInsertSchema(model)
  const spec = zodToFormSpec(insertSchema)
  const foreignKeys = getTableForeignKeys(model)
  const specWithForeignKeys = await addForeignKeysToFormSpec(spec, cfg, foreignKeys)

  const specWithO2mRelations = cfg.o2m ? await addO2mRelationsToFormSpec(specWithForeignKeys, cfg) : specWithForeignKeys

  const m2mRelations = cfg.m2m ? parseM2mRelations(cfg.model, cfg.m2m) : []
  const specWithM2mRelations = await addM2mRelationsToFormSpec(specWithO2mRelations, cfg, m2mRelations)

  if (cfg.update.formFields || cfg.fields) {
    spec.fields = useDefinedFields(specWithM2mRelations, cfg)
  }

  const specWithMetadata = await useMetadataOnFormSpec(specWithM2mRelations, cfg.metadata)
  specWithMetadata.warnOnUnsavedChanges = cfg.create.warnOnUnsavedChanges

  const config = useRuntimeConfig()
  const apiPrefix = config.public.apiPrefix
  specWithMetadata.endpoint = cfg.update.endpoint ?? `${apiPrefix}/${modelKey}`
  specWithMetadata.listTitle = cfg.list.title ?? cfg.label
  specWithMetadata.schema = zerialize(cfg.update.schema)
  specWithMetadata.slugFields = cfg.slugFields

  return {
    spec: specWithMetadata,
  }
})
