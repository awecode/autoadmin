import type { AdminModelConfig } from '#layers/autoadmin/server/utils/registry'
import type { InferSelectModel, Table } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { useAdminDb } from '../utils/db'
import { colKey, handleDrizzleError } from '../utils/drizzle'
import { parseM2mRelations, saveM2mRelation, saveO2mRelation } from '../utils/relation'
import { ensureUniqueSlugs, isSlugUniqueViolation } from '../utils/slug'
import { unwrapZodType } from '../utils/zod'

export async function updateRecord<T extends Table>(cfg: AdminModelConfig<T>, lookupValue: string, data: any): Promise<any> {
  const modelKey = cfg.key
  if (!cfg.update.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model "${modelKey}" does not allow updates.`,
    })
  }
  const model = cfg.model
  const db = useAdminDb()
  let inputData = typeof data === 'object' && data !== null ? { ...data } : {}

  const beforeData = await cfg.update.before?.(db, {
    config: cfg,
    lookupValue,
    data: { ...inputData },
  })

  if (typeof beforeData !== 'undefined') {
    inputData = beforeData
  }

  const schema = cfg.update.schema

  const shape = schema.shape

  // Preprocess string values into Date for date fields
  const preprocessed = { ...inputData }
  for (const key in shape) {
    const fieldSchema = unwrapZodType(shape[key]!)
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
  }
  catch (error) {
    if (isSlugUniqueViolation(cfg, error)) {
      await ensureUniqueSlugs(cfg, validatedData as Record<string, any>, lookupValue)
      try {
        result = await db.update(model).set(validatedData).where(eq(cfg.lookupColumn, lookupValue)).returning()
      }
      catch (retryError) {
        throw createError(handleDrizzleError(retryError))
      }
    }
    else {
      throw createError(handleDrizzleError(error))
    }
  }

  if (!result.length) {
    throw createError({
      statusCode: 404,
      statusMessage: `${modelKey} with lookup value "${lookupValue}" not found.`,
    })
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

  await cfg.update.after?.(db, {
    config: cfg,
    lookupValue,
    data: { ...inputData },
    validatedData: { ...validatedData as Record<string, any> },
    record: result[0]! as unknown as InferSelectModel<T>,
  })

  return {
    success: true,
    message: `${modelKey} updated successfully`,
    data: result[0],
  }
}
