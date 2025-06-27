import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { count } from 'drizzle-orm'
import { createInsertSchema } from 'drizzle-zod'

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
  const model = getModel(modelLabel)
  const db = useDb()

  const insertSchema = createInsertSchema(model)
  const validatedData = insertSchema.parse(data)

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
