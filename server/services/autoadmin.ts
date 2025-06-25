import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { count } from 'drizzle-orm'

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
    // TODO: Implement actual database calls
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

// TODO: Implement actual database calls
export async function createRecord(modelLabel: string, data: any): Promise<any> {
    return {
        id: Date.now(),
        ...data,
        created_at: new Date().toISOString(),
    }
}

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