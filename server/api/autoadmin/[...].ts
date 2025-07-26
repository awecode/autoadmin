import { createRecord } from '../../services/create'
import { deleteRecord } from '../../services/delete'
import { getRecordDetail } from '../../services/detail'
import { listRecords } from '../../services/list'
import { updateRecord } from '../../services/update'
import { parseAutoadminRoute } from '../../utils/router'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const method = event.method

  // URL Structure:
  // <apiPrefix>/<autoadmin-route>

  // Autoadmin Route Structure:
  // GET <model-label>: List
  // POST <model-label> <body>: Create
  // GET <model-label>/<lookup-field-value>: Detail
  // POST/PATCH/PUT <model-label>/<lookup-field-value> <body>: Update
  // DELETE <model-label>/<lookup-field-value>: Delete

  const config = useRuntimeConfig()
  const apiPrefix = (config.public.apiPrefix) as string
  const pathSegments = url.pathname.split(apiPrefix)[1] || ''

  const parsedRoute = parseAutoadminRoute(pathSegments, method)

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
})
