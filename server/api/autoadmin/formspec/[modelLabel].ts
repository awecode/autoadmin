import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { zodToFormSpec } from '#layers/autoadmin/utils/form'
import { getTableMetadata, useMetadataOnFormSpec } from '#layers/autoadmin/utils/metdata'
import { addRelationToFormSpec, getTableRelations } from '#layers/autoadmin/utils/relation'
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
  const specWithRelations = await addRelationToFormSpec(spec, relations)
  const metadata = getTableMetadata(model)
  return useMetadataOnFormSpec(specWithRelations, metadata)
})
