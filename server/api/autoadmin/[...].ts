import { parseAutoadminRoute, getHttpMethodForRoute } from '#layers/autoadmin/server/utils/router'
import { listRecords, createRecord, getRecordDetail, updateRecord, deleteRecord } from '#layers/autoadmin/server/services/autoadmin'

export default defineEventHandler(async (event) => {
    try {
        const url = getRequestURL(event)
        const method = getMethod(event)

        const pathSegments = url.pathname.split('/api/autoadmin/')[1] || ''

        const parsedRoute = parseAutoadminRoute(pathSegments)

        const allowedMethods = getHttpMethodForRoute(parsedRoute.routeType)
        if (!allowedMethods.includes(method)) {
            throw createError({
                statusCode: 405,
                statusMessage: `Method ${method} not allowed for ${parsedRoute.routeType} operation`,
            })
        }

        const query = getQuery(event)
        const body = method !== 'GET' ? await readBody(event) : undefined

        switch (parsedRoute.routeType) {
            case 'list':
                return await listRecords(parsedRoute.modelLabel, query)

            case 'create':
                if (!body) {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Request body is required for create operation',
                    })
                }
                return await createRecord(parsedRoute.modelLabel, body)

            case 'detail':
                if (!parsedRoute.lookupValue) {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Lookup value is required for detail operation',
                    })
                }
                return await getRecordDetail(parsedRoute.modelLabel, parsedRoute.lookupValue)

            case 'update':
                if (!parsedRoute.lookupValue) {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Lookup value is required for update operation',
                    })
                }
                if (!body) {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Request body is required for update operation',
                    })
                }
                return await updateRecord(parsedRoute.modelLabel, parsedRoute.lookupValue, body)

            case 'delete':
                if (!parsedRoute.lookupValue) {
                    throw createError({
                        statusCode: 400,
                        statusMessage: 'Lookup value is required for delete operation',
                    })
                }
                return await deleteRecord(parsedRoute.modelLabel, parsedRoute.lookupValue)

            default:
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Invalid route type',
                })
        }
    } catch (error: any) {
        if (error.statusCode) {
            throw error
        }

        throw createError({
            statusCode: 400,
            statusMessage: error.message || 'Invalid request',
        })
    }
})