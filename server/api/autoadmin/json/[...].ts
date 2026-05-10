import {
  createJsonArrayRecord,
  deleteJsonArrayRecord,
  getJsonArrayDetail,
  getJsonObjectDetail,
  listJsonArrayRecords,
  updateJsonArrayRecord,
  updateJsonObjectRecord,
} from '../../../services/jsonResourceCrud'
import { JSON_OBJECT_LOOKUP, useJsonResourceRegistry } from '../../../utils/jsonResourceRegistry'
import { parseJsonResourceRoute, pathAfterJsonApiPrefix } from '../../../utils/jsonResourceRouter'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const method = event.method
  const jsonPrefix = useJsonResourceRegistry().apiPrefix
  const pathSegments = pathAfterJsonApiPrefix(url.pathname, jsonPrefix)
  const parsed = parseJsonResourceRoute(pathSegments, method)
  const query = getQuery(event)
  const body = method !== 'GET' && method !== 'DELETE' ? await readBody(event) : undefined

  const reg = useJsonResourceRegistry()
  const cfg = reg.get(parsed.resourceKey)
  if (!cfg) {
    throw createError({
      statusCode: 404,
      statusMessage: `JSON admin resource "${parsed.resourceKey}" is not registered.`,
    })
  }

  if (cfg.kind === 'object') {
    if (parsed.routeType === 'list' || parsed.routeType === 'create') {
      throw createError({
        statusCode: 400,
        statusMessage: 'This JSON resource is a single object. Use the JSON admin object edit page instead of list/create APIs.',
      })
    }
    if (parsed.routeType === 'detail' || parsed.routeType === 'update' || parsed.routeType === 'delete') {
      if (parsed.lookupValue !== JSON_OBJECT_LOOKUP) {
        throw createError({
          statusCode: 404,
          statusMessage: `Use lookup "${JSON_OBJECT_LOOKUP}" for object JSON resources.`,
        })
      }
    }
  }

  switch (parsed.routeType) {
    case 'list': {
      if (cfg.kind !== 'array') {
        throw createError({ statusCode: 400, statusMessage: 'Not an array resource.' })
      }
      return await listJsonArrayRecords(cfg, query)
    }
    case 'create': {
      if (cfg.kind !== 'array') {
        throw createError({ statusCode: 400, statusMessage: 'Not an array resource.' })
      }
      if (!body) {
        throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
      }
      return await createJsonArrayRecord(cfg, body)
    }
    case 'detail': {
      if (!parsed.lookupValue) {
        throw createError({ statusCode: 400, statusMessage: 'Lookup value is required.' })
      }
      if (cfg.kind === 'array') {
        return await getJsonArrayDetail(cfg, parsed.lookupValue)
      }
      return await getJsonObjectDetail(cfg, parsed.lookupValue!)
    }
    case 'update': {
      if (!parsed.lookupValue) {
        throw createError({ statusCode: 400, statusMessage: 'Lookup value is required.' })
      }
      if (!body) {
        throw createError({ statusCode: 400, statusMessage: 'Request body is required.' })
      }
      if (cfg.kind === 'array') {
        return await updateJsonArrayRecord(cfg, parsed.lookupValue, body)
      }
      return await updateJsonObjectRecord(cfg, parsed.lookupValue, body)
    }
    case 'delete': {
      if (!parsed.lookupValue) {
        throw createError({ statusCode: 400, statusMessage: 'Lookup value is required.' })
      }
      if (cfg.kind !== 'array') {
        throw createError({ statusCode: 400, statusMessage: 'Delete is only supported for array JSON resources.' })
      }
      return await deleteJsonArrayRecord(cfg, parsed.lookupValue)
    }
    default:
      throw createError({ statusCode: 400, statusMessage: 'Invalid route.' })
  }
})
