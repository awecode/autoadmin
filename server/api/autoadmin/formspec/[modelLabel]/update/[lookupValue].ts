import type { Table } from 'drizzle-orm'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { zodToFormSpec } from '#layers/autoadmin/utils/form'
import { getTableMetadata, useMetadataOnFormSpec } from '#layers/autoadmin/utils/metdata'
import { addRelationToFormSpec, getTableRelations } from '#layers/autoadmin/utils/relation'
import { eq } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-zod'

type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

const getTableValues = async (cfg: AdminModelConfig<Table>, spec: FormSpec, lookupValue: string) => {
  const db = useDb()
  const model = cfg.model
  const lookupColumn = cfg.lookupColumn
  const columns = spec.fields.map(field => field.name as ColKey<typeof model>)

  const selectObj = Object.fromEntries(
    columns.map(colName => [colName, model[colName]]),
  )
  const values = await db
    .select(selectObj)
    .from(model)
    .where(eq(lookupColumn, lookupValue))
  return values[0]
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
  const model = cfg.model
  const insertSchema = createInsertSchema(model)
  const spec = zodToFormSpec(insertSchema as any)
  const relations = getTableRelations(model)
  const specWithRelations = await addRelationToFormSpec(spec, relations)
  const metadata = getTableMetadata(model)
  const processedSpec = await useMetadataOnFormSpec(specWithRelations, metadata)
  return {
    spec: processedSpec,
    schema: insertSchema.shape,
    values: await getTableValues(cfg, processedSpec, lookupValue),
  }
})
