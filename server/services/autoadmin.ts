import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'

export async function listRecords(modelLabel: string, query: Record<string, any> = {}): Promise<any> {
    // TODO: Implement actual database calls
    const registry = useAdminRegistry()
    console.log("A", registry.all(), "B")
    const model = registry.get(modelLabel)
    if (!model) {
        throw createError({
            statusCode: 404,
            statusMessage: `Model ${modelLabel} not registered.`,
        })
    }
    return {
        results: [
            { id: 1, name: `Sample ${modelLabel} 1` },
            { id: 2, name: `Sample ${modelLabel} 2` },
        ],
        pagination: {
            count: 2,
            size: 10,
            page: 1,
            pages: 1,
        }
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