import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { unwrapZodType } from '#layers/autoadmin/utils/form'
import { count } from 'drizzle-orm'

function getModel(modelLabel: string) {
  const registry = useAdminRegistry()
  const modelConfig = registry.get(modelLabel)
  if (!modelConfig) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} not registered.`,
    })
  }
  return modelConfig.model
}

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
  const model = getModel(modelLabel)
  const db = useDb()

  const baseQuery = db.select().from(model)
  const countQuery = db.select({ resultCount: count() }).from(model)

  try {
    return getPaginatedResponse<typeof model>(baseQuery, countQuery, query)
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch platforms',
      data: error,
    })
  }
}

export async function createRecord(modelLabel: string, data: any): Promise<any> {
  const registry = useAdminRegistry()
  const modelConfig = registry.get(modelLabel)
  if (!modelConfig) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} not registered.`,
    })
  }
  const model = modelConfig.model
  const db = useDb()

  const schema = modelConfig.create.schema

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

  const result = await db.insert(model).values(validatedData).returning()

  return {
    success: true,
    message: `${modelLabel} created successfully`,
    data: result,
  }
}

// TODO: Implement actual database calls
export async function getRecordDetail(modelLabel: string, lookupValue: string): Promise<any> {
  return {
    id: lookupValue,
    name: `Sample ${modelLabel}`,
    created_at: new Date().toISOString(),
  }
}

export async function updateRecord(modelLabel: string, lookupValue: string, data: any): Promise<any> {
  return {
    id: lookupValue,
    ...data,
    updated_at: new Date().toISOString(),
  }
}

export async function deleteRecord(modelLabel: string, lookupValue: string): Promise<any> {
  return {
    success: true,
    message: `${modelLabel} ${lookupValue} deleted successfully`,
  }
}
