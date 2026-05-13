export type JsonAdminTakeoverMode = 'auto' | 'always' | 'never'

export interface JsonAdminPublicConfig {
  /** JSON-admin API base (no trailing slash). Empty → `{apiPrefix}/json`. */
  jsonApiPrefix?: string
  linkLabel?: string
  linkIcon?: string
  injectSidebar?: boolean
  showDashboardCard?: boolean
  takeoverMode?: JsonAdminTakeoverMode
}

/** Subset of `runtimeConfig.public` needed to resolve JSON admin API base URL and UI options. */
export interface JsonAdminPublicRuntime {
  autoadmin?: {
    apiPrefix?: string
    jsonadmin?: JsonAdminPublicConfig
  }
}

/** Client shape aligned with `/api/autoadmin/json/registry-meta`. */
export interface JsonAdminRegistryLink {
  label: string
  icon?: string
  kind: 'object' | 'array'
  to: { name: string, params: { modelKey: string } }
  createPath?: { name: string, params: { modelKey: string } }
  searchPlaceholder?: string
}

/**
 * JSON-admin API base (no trailing slash): `public.autoadmin.jsonadmin.jsonApiPrefix` when set,
 * otherwise `{public.autoadmin.apiPrefix}/json` (default apiPrefix `/api/autoadmin`).
 */
export function resolveJsonAdminApiPrefix(pub: JsonAdminPublicRuntime): string {
  const explicit = String(pub.autoadmin?.jsonadmin?.jsonApiPrefix ?? '').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  if (explicit) {
    return explicit.startsWith('/') ? explicit : `/${explicit}`
  }
  const base = String(pub.autoadmin?.apiPrefix ?? '/api/autoadmin').trim().replace(/\/+$/, '').replace(/\/+/g, '/')
  const baseAbs = base.startsWith('/') ? base : `/${base}`
  return `${baseAbs}/json`
}
