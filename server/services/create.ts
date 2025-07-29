import type { AdminModelConfig } from '#layers/autoadmin/composables/registry'
import type { Table } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { colKey, handleDrizzleError } from '../utils/drizzle'
import { parseM2mRelations, saveM2mRelation, saveO2mRelation } from '../utils/relation'
import { unwrapZodType } from '../utils/zod'

export async function createRecord<T extends Table>(cfg: AdminModelConfig<T>, data: any): Promise<any> {
  const modelLabel = cfg.label
  if (!cfg.create.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow creation.`,
    })
  }
  const model = cfg.model
  const db = useDb()

  const schema = cfg.create.schema

  const shape = schema.shape

  // Preprocess string values into Date for date fields
  const preprocessed = { ...data }
  for (const key in shape) {
    const fieldSchema = unwrapZodType(shape[key])
    if (fieldSchema.innerType.def.type === 'date' && typeof preprocessed[key] === 'string') {
      const maybeDate = new Date(preprocessed[key])
      if (!Number.isNaN(maybeDate.getTime())) {
        preprocessed[key] = maybeDate
      }
    }
  }

  const validatedData = schema.parse(preprocessed)

  let result
  try {
    result = await db.insert(model).values(validatedData).returning()
  } catch (error) {
    throw handleDrizzleError(error)
  }

  if (cfg.m2m) {
    const relations = parseM2mRelations(model, cfg.m2m)
    for (const relation of relations) {
      const fieldName = `___${relation.name}___${colKey(relation.otherColumn)}`
      if (preprocessed[fieldName]) {
        const selfValue = result[0]![colKey(relation.selfForeignColumn)]
        await saveM2mRelation(db, relation, selfValue, preprocessed[fieldName])
      }
    }
  }

  await saveO2mRelation(db, cfg, preprocessed, result)

  return {
    success: true,
    message: `${modelLabel} created successfully`,
    data: result[0],
  }
}
