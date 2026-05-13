export interface AutoAdminRouteLink {
  name: string
  params?: { modelKey: string } | Record<string, string>
}

export interface AutoAdminRegistryLink {
  label: string
  icon?: string
  to: AutoAdminRouteLink
  type: 'link'
  createPath?: AutoAdminRouteLink
  searchPlaceholder?: string
}

export interface JsonAdminRegistryLink {
  label: string
  icon?: string
  kind: 'object' | 'array'
  to: { name: string, params: { modelKey: string } }
  createPath?: AutoAdminRouteLink
  searchPlaceholder?: string
}

export interface AutoAdminMetaResponse {
  drizzle: AutoAdminRegistryLink[]
  json: JsonAdminRegistryLink[]
}
