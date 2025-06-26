export type RouteType = 'list' | 'create' | 'detail' | 'update' | 'delete'

export interface ParsedRoute {
  modelLabel: string
  lookupValue?: string
  routeType: RouteType
}

export function parseAutoadminRoute(path: string, method: string): ParsedRoute {
  // Remove leading slash and split path
  const segments = path.replace(/^\/+/, '').split('/').filter(Boolean)

  if (segments.length === 0) {
    throw new Error('Invalid route: empty path')
  }

  const modelLabel = segments[0]

  // Pattern matching based on URL structure and HTTP method
  if (segments.length === 1) {
    // GET <model-label>: List
    if (method === 'GET') {
      return {
        modelLabel,
        routeType: 'list',
      }
    } else if (method === 'POST') {
      // POST <model-label> <body>: Create
      return {
        modelLabel,
        routeType: 'create',
      }
    }
  }

  if (segments.length === 2) {
    const lookupValue = segments[1]

    if (method === 'GET') {
      // GET <model-label>/<lookup-field-value>: Detail
      return {
        modelLabel,
        lookupValue,
        routeType: 'detail',
      }
    } else if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      // POST/PATCH/PUT <model-label>/<lookup-field-value> <body>: Update
      return {
        modelLabel,
        lookupValue,
        routeType: 'update',
      }
    } else if (method === 'DELETE') {
      // DELETE <model-label>/<lookup-field-value>: Delete
      return {
        modelLabel,
        lookupValue,
        routeType: 'delete',
      }
    }
  }

  throw new Error(`Invalid route pattern: ${path} with method ${method}`)
}
