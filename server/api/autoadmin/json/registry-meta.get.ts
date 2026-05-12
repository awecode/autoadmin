import type { JsonCrudRoute } from '../../../utils/jsonResourceRegistry'
import { getIconForLabel } from '#layers/autoadmin/utils/string'
import { useJsonResourceRegistry } from '../../../utils/jsonResourceRegistry'
import { getAllowedActions } from '../../../utils/roleHelpers'

interface JsonRegistryLink {
  label: string
  icon: string
  kind: 'object' | 'array'
  to: { name: string, params: { modelKey: string } }
  createPath?: JsonCrudRoute
  searchPlaceholder?: string
}

export default defineEventHandler(async (event) => {
  const reg = useJsonResourceRegistry()
  const meta = reg.all().flatMap<JsonRegistryLink>((cfg) => {
    if (!cfg.enableIndex) {
      return []
    }
    const allowed = getAllowedActions(event, { roles: cfg.roles })
    if (cfg.kind === 'object') {
      // Object resources only expose an editor; drop unless the user can update.
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
  return meta
})
