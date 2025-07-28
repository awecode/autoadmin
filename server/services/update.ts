import type { AdminModelConfig } from '#layers/autoadmin/composables/registry'
import { eq } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { colKey, handleDrizzleError } from '../utils/drizzle'
import { parseM2mRelations, saveM2mRelation, saveO2mRelation } from '../utils/relation'
import { unwrapZodType } from '../utils/zod'

export async function updateRecord(cfg: AdminModelConfig, lookupValue: string, data: any): Promise<any> {
  const modelLabel = cfg.label
  if (!cfg.update.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} does not allow updates.`,
    })
  }
  const model = cfg.model
  const db = useDb()

  const schema = cfg.update.schema

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
    result = await db.update(model).set(validatedData).where(eq(cfg.lookupColumn, lookupValue)).returning()
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
    message: `${modelLabel} updated successfully`,
    data: result[0],
  }
}
