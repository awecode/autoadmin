import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { zodToFormSpec } from '#layers/autoadmin/utils/form'
import { getTableMetadata, useMetadataOnFormSpec } from '#layers/autoadmin/utils/metdata'
import { addManyRelationsToFormSpec, addRelationToFormSpec, getTableRelations, parseRelations } from '#layers/autoadmin/utils/relation'
import { createInsertSchema } from 'drizzle-zod'

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
  const model = cfg.model
  const insertSchema = createInsertSchema(model)
  const spec = zodToFormSpec(insertSchema as any)
  const relations = getTableRelations(model)
  const parsedRelations = cfg.relations ? parseRelations(cfg.model, cfg.relations) : { m2m: [] }
  const specWithRelations = await addRelationToFormSpec(spec, modelLabel, relations)
  const specWithRelationsMany = await addManyRelationsToFormSpec(specWithRelations, modelLabel, parsedRelations.m2m)

  const metadata = getTableMetadata(model)
  return {
    spec: await useMetadataOnFormSpec(specWithRelationsMany, metadata),
    schema: insertSchema.shape,
  }
})
