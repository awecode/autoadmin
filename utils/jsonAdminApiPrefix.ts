export type AutoadminJsonAdminTakeoverMode = 'auto' | 'always' | 'never'

export interface AutoadminJsonAdminPublicConfig {
  linkLabel?: string
  linkIcon?: string
  injectSidebar?: boolean
  showDashboardCard?: boolean
  takeoverMode?: AutoadminJsonAdminTakeoverMode
}

/** Subset of `runtimeConfig.public` needed to resolve JSON admin API base URL and UI options. */
export interface JsonAdminPublicRuntime {
  autoadmin?: {
    apiPrefix?: string
    jsonApiPrefix?: string
    jsonadmin?: AutoadminJsonAdminPublicConfig
  }
}

/**
 * JSON-admin API base (no trailing slash): `public.autoadmin.jsonApiPrefix` when set,
 * otherwise `{public.autoadmin.apiPrefix}/json` (default apiPrefix `/api/autoadmin`).
 */
export function resolveJsonAdminApiPrefix(pub: JsonAdminPublicRuntime): string {
  const explicit = String(pub.autoadmin?.jsonApiPrefix ?? '').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  if (explicit) {
    return explicit.startsWith('/') ? explicit : `/${explicit}`
  }
  const base = String(pub.autoadmin?.apiPrefix ?? '/api/autoadmin').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  const baseAbs = base.startsWith('/') ? base : `/${base}`
  return `${baseAbs}/json`
}
