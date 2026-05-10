/** Path segment for object JSON resources in API and formspec URLs (must match server constant). */
export const JSON_ADMIN_OBJECT_LOOKUP = '__root__' as const

/**
 * Base URL for GitHub JSON admin API (no trailing slash).
 * Matches server `useJsonResourceRegistry().apiPrefix`.
 */
export function useJsonAdminApiPrefix(): string {
  const c = useRuntimeConfig()
  const pub = c.public as { jsonAdmin?: { apiPrefix?: string }, autoadmin?: { apiPrefix?: string } }
  const explicit = String(pub.jsonAdmin?.apiPrefix ?? '').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  if (explicit) {
    return explicit.startsWith('/') ? explicit : `/${explicit}`
  }
  const base = String(pub.autoadmin?.apiPrefix ?? '/api/autoadmin').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  const baseAbs = base.startsWith('/') ? base : `/${base}`
  return `${baseAbs}/json`
}
