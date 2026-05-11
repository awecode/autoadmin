import { resolveJsonAdminApiPrefix } from '#layers/autoadmin/utils/jsonAdminApiPrefix'

/** Path segment for object JSON resources in API and formspec URLs (must match server constant). */
export const JSON_ADMIN_OBJECT_LOOKUP = '__root__' as const

/**
 * Base URL for JSON admin API (no trailing slash).
 * Same resolution as server `useJsonResourceRegistry().apiPrefix` — see `resolveJsonAdminApiPrefix`.
 */
export function useJsonAdminApiPrefix(): string {
  return resolveJsonAdminApiPrefix(useRuntimeConfig().public)
}
