export type RouteType = 'list' | 'create' | 'detail' | 'update' | 'delete'

export interface ParsedRoute {
  modelKey: string
  lookupValue?: string
  routeType: RouteType
}

export function parseAutoadminRoute(path: string, method: string): ParsedRoute {
  // Remove leading slash and split path
  const segments = path.replace(/^\/+/, '').split('/').filter(Boolean)

  if (segments.length === 0) {
    throw new Error('Invalid route: empty path')
  }

  const modelKey = segments[0]!

  // Pattern matching based on URL structure and HTTP method
  if (segments.length === 1) {
    // GET <model-label>: List
    if (method === 'GET') {
      return {
        modelKey,
        routeType: 'list',
      }
    } else if (method === 'POST') {
      // POST <model-label> <body>: Create
      return {
        modelKey,
        routeType: 'create',
      }
    }
  }

  if (segments.length === 2) {
    const lookupValue = segments[1]

    if (method === 'GET') {
      // GET <model-label>/<lookup-field-value>: Detail
      return {
        modelKey,
        lookupValue,
        routeType: 'detail',
      }
    } else if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      // POST/PATCH/PUT <model-label>/<lookup-field-value> <body>: Update
      return {
        modelKey,
        lookupValue,
        routeType: 'update',
      }
    } else if (method === 'DELETE') {
      // DELETE <model-label>/<lookup-field-value>: Delete
      return {
        modelKey,
        lookupValue,
        routeType: 'delete',
      }
    }
  }

  throw new Error(`Invalid route pattern: ${path} with method ${method}`)
}
