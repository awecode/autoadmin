export interface JsonAdminRegistryLink {
  label: string
  icon?: string
  kind: 'object' | 'array'
  to: { name: string, params: { modelKey: string } }
  createPath?: { name: string, params: { modelKey: string } }
  searchPlaceholder?: string
}
