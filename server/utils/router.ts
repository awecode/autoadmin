export type RouteType = 'list' | 'create' | 'detail' | 'update' | 'delete'

export interface ParsedRoute {
    modelLabel: string
    lookupValue?: string
    routeType: RouteType
}

export function parseAutoadminRoute(path: string): ParsedRoute {
    // Remove leading slash and split path
    const segments = path.replace(/^\/+/, '').split('/').filter(Boolean)

    if (segments.length === 0) {
        throw new Error('Invalid route: empty path')
    }

    const modelLabel = segments[0]

    // Pattern matching based on URL structure
    if (segments.length === 1) {
        // <model-label>: List
        return {
            modelLabel,
            routeType: 'list'
        }
    }

    if (segments.length === 2) {
        if (segments[1] === 'add') {
            // <model-label>/add: Create
            return {
                modelLabel,
                routeType: 'create'
            }
        } else {
            // <model-label>/<lookup-field-value>: Detail
            return {
                modelLabel,
                lookupValue: segments[1],
                routeType: 'detail'
            }
        }
    }

    if (segments.length === 3) {
        const lookupValue = segments[1]
        const action = segments[2]

        if (action === 'edit') {
            // <model-label>/<lookup-field-value>/edit: Update
            return {
                modelLabel,
                lookupValue,
                routeType: 'update'
            }
        } else if (action === 'delete') {
            // <model-label>/<lookup-field-value>/delete: Delete
            return {
                modelLabel,
                lookupValue,
                routeType: 'delete'
            }
        }
    }

    throw new Error(`Invalid route pattern: ${path}`)
}

export function getHttpMethodForRoute(routeType: RouteType): string[] {
    switch (routeType) {
        case 'list':
            return ['GET']
        case 'create':
            return ['POST']
        case 'detail':
            return ['GET']
        case 'update':
            return ['PUT', 'PATCH']
        case 'delete':
            return ['DELETE']
        default:
            return []
    }
} 