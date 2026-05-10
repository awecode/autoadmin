import type { RouteType } from './router'

export interface ParsedJsonResourceRoute {
  resourceKey: string
  lookupValue?: string
  routeType: RouteType
}

/** Collapse duplicate slashes; trim trailing slash (root stays `/`). */
function normalizeUrlPath(p: string | undefined | null): string {
  const s = typeof p === 'string' ? p : String(p ?? '/')
  const collapsed = (s || '/').replace(/\/+/g, '/')
  if (collapsed === '/' || collapsed === '') {
    return '/'
  }
  return collapsed.replace(/\/$/, '') || '/'
}

/**
 * Path after the JSON admin API prefix, with no leading slash (empty string if the request path is exactly the prefix).
 * Uses prefix matching so `pathname.split(prefix)` cannot silently fail when prefix omits a leading `/` or paths differ by slashes.
 */
export function pathAfterJsonApiPrefix(pathname: string | undefined | null, jsonPrefix: unknown): string {
  let path = normalizeUrlPath(pathname ?? '/')
  const prefixRaw = jsonPrefix == null ? '' : String(jsonPrefix)
  let prefix = prefixRaw.trim().replace(/\/+/g, '/')
  if (!prefix) {
    throw createError({
      statusCode: 500,
      statusMessage: 'JSON admin API prefix is empty.',
    })
  }
  if (!prefix.startsWith('/')) {
    prefix = `/${prefix}`
  }
  prefix = normalizeUrlPath(prefix)
  if (!path.startsWith('/')) {
    path = `/${path}`
  }
  path = normalizeUrlPath(path)

  if (path === prefix) {
    return ''
  }
  const withSlash = `${prefix}/`
  if (!path.startsWith(withSlash)) {
    throw createError({
      statusCode: 404,
      statusMessage: `JSON admin URL path does not match configured prefix "${prefix}".`,
    })
  }
  return path.slice(withSlash.length)
}

/** Path after `/api/autoadmin/json` (no leading slash). */
export function parseJsonResourceRoute(path: string, method: string): ParsedJsonResourceRoute {
  const segments = path.replace(/^\/+/, '').split('/').filter(Boolean)

  if (segments.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid JSON admin route: empty path',
    })
  }

  const resourceKey = segments[0]!

  if (segments.length === 1) {
    if (method === 'GET') {
      return { resourceKey, routeType: 'list' }
    }
    if (method === 'POST') {
      return { resourceKey, routeType: 'create' }
    }
  }

  if (segments.length === 2) {
    const lookupValue = segments[1]
    if (method === 'GET') {
      return { resourceKey, lookupValue, routeType: 'detail' }
    }
    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      return { resourceKey, lookupValue, routeType: 'update' }
    }
    if (method === 'DELETE') {
      return { resourceKey, lookupValue, routeType: 'delete' }
    }
  }

  throw createError({
    statusCode: 404,
    statusMessage: `Invalid JSON admin route: ${path} (${method})`,
  })
}
