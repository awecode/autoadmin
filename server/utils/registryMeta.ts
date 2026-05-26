import type { AutoAdminRegistryLink, JsonAdminRegistryLink } from '#layers/autoadmin/utils/registryMeta'
import type { H3Event } from 'h3'
import { useJsonResourceRegistry } from '#layers/autoadmin/server/utils/jsonResourceRegistry'
import { useAdminRegistry } from '#layers/autoadmin/server/utils/registry'
import { getIconForLabel } from '#layers/autoadmin/utils/string'
import { getAllowedActions } from './roleHelpers'

export function buildDrizzleRegistryMeta(event: H3Event): AutoAdminRegistryLink[] {
  const registry = useAdminRegistry()
  const ordered = [...registry.all()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return ordered.flatMap<AutoAdminRegistryLink>((cfg) => {
    if (!cfg.enableIndex) {
      return []
    }
    const allowed = getAllowedActions(event, { roles: cfg.roles })
    const canList = allowed.list
    const canCreate = cfg.create.enabled && allowed.create
    if (!canList && !canCreate) {
      return []
    }
    const to = canList
      ? { name: 'autoadmin-list' as const, params: { modelKey: cfg.key } }
      : { name: 'autoadmin-create' as const, params: { modelKey: cfg.key } }
    return [{
      label: cfg.label,
      icon: cfg.icon || getIconForLabel(cfg.label),
      to,
      type: 'link' as const,
      createPath: (canList && canCreate) ? cfg.create.route : undefined,
      searchPlaceholder: (canList && cfg.list.enableSearch) ? cfg.list.searchPlaceholder : undefined,
    }]
  })
}

export function buildJsonRegistryMeta(event: H3Event): JsonAdminRegistryLink[] {
  const reg = useJsonResourceRegistry()
  return reg.all().flatMap<JsonAdminRegistryLink>((cfg) => {
    if (!cfg.enableIndex) {
      return []
    }
    const allowed = getAllowedActions(event, { roles: cfg.roles })
    if (cfg.kind === 'object') {
      if (!allowed.update) {
        return []
      }
      return [{
        label: cfg.label,
        icon: cfg.icon || getIconForLabel(cfg.label),
        kind: 'object',
        to: { name: 'jsonadmin-object-edit', params: { modelKey: cfg.key } },
      }]
    }
    const canList = allowed.list
    const canCreate = cfg.create.enabled && allowed.create
    if (!canList && !canCreate) {
      return []
    }
    const to = canList
      ? { name: 'jsonadmin-array-list', params: { modelKey: cfg.key } }
      : { name: 'jsonadmin-array-create', params: { modelKey: cfg.key } }
    return [{
      label: cfg.label,
      icon: cfg.icon || getIconForLabel(cfg.label),
      kind: 'array',
      to,
      createPath: (canList && canCreate) ? cfg.create.route : undefined,
      searchPlaceholder: (canList && cfg.list.enableSearch) ? cfg.list.searchPlaceholder : undefined,
    }]
  })
}
