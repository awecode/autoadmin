import type { M2MRelation } from '#layers/autoadmin/utils/relation'
import type { Table } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { zodToFormSpec } from '#layers/autoadmin/utils/form'
import { getTableMetadata, useMetadataOnFormSpec } from '#layers/autoadmin/utils/metdata'
import { addManyRelationsToFormSpec, addRelationToFormSpec, getTableRelations, parseM2mRelations } from '#layers/autoadmin/utils/relation'
import { eq } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-zod'

type ColKey<T extends Table> = Extract<keyof T['_']['columns'], string>

async function getM2mRelationValues(db: DrizzleD1Database, relation: M2MRelation, selfValue: any) {
  // if the m2m table has only two columns, we can delete and insert all at once
  // const values = db.select(relation.otherColumn).from(relation.m2mTable).where(eq(relation.m2mTable[relation.selfColumnName], selfValue))
  const values = db.select().from(relation.m2mTable).where(eq(relation.m2mTable[relation.selfColumnName], selfValue))
  return values
}

const getTableValues = async (cfg: AdminModelConfig<Table>, spec: FormSpec, lookupValue: string) => {
  const db = useDb()
  const model = cfg.model
  const lookupColumn = cfg.lookupColumn
  const columns = spec.fields.map(field => field.name as ColKey<typeof model>)

  const selectObj = Object.fromEntries(
    columns.map(colName => [colName, model[colName]]),
  )
  const result = await db
    .select(selectObj)
    .from(model)
    .where(eq(lookupColumn, lookupValue))
  const values = result[0]

  // also get m2m values
  if (cfg.m2m) {
    const relations = parseM2mRelations(model, cfg.m2m)
    for (const relation of relations) {
      const fieldName = `___${relation.name}___${relation.otherColumnName}`
      const selfValue = result[0][relation.selfForeignColumnName]
      const m2mValues = await getM2mRelationValues(db, relation, selfValue)
      values[fieldName] = m2mValues.map(value => value[relation.otherColumnName])
    }
  }

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
  const model = cfg.model
  const insertSchema = createInsertSchema(model)
  const spec = zodToFormSpec(insertSchema as any)
  const relations = getTableRelations(model)
  const values = await getTableValues(cfg, spec, lookupValue)
  const m2mRelations = cfg.m2m ? parseM2mRelations(cfg.model, cfg.m2m) : []
  const specWithRelations = await addRelationToFormSpec(spec, modelLabel, relations, values)
  const specWithRelationsMany = await addManyRelationsToFormSpec(specWithRelations, modelLabel, m2mRelations, values)
  const metadata = getTableMetadata(model)
  const processedSpec = await useMetadataOnFormSpec(specWithRelationsMany, metadata)
  return {
    spec: processedSpec,
    schema: insertSchema.shape,
    values,
  }
})
