import { getIconForLabel } from '#layers/autoadmin/utils/string'
import { useJsonResourceRegistry } from '../../../utils/jsonResourceRegistry'
import { getAllowedActions } from '../../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const reg = useJsonResourceRegistry()
  const meta = reg.all().flatMap((cfg) => {
    if (!cfg.enableIndex) { return [] }
    const allowed = getAllowedActions(event, { roles: cfg.roles })
    if (cfg.kind === 'object') {
      // Object resources only expose an editor; drop unless the user can update.
      if (!allowed.update) { return [] }
      return [{
        label: cfg.label,
        icon: cfg.icon || getIconForLabel(cfg.label),
        kind: 'object' as const,
        to: { name: 'jsonadmin-object-edit' as const, params: { modelKey: cfg.key } },
        createPath: undefined,
        searchPlaceholder: undefined,
      }]
    }
    const canList = allowed.list
    const canCreate = cfg.create.enabled && allowed.create
    if (!canList && !canCreate) { return [] }
    const to = canList
      ? { name: 'jsonadmin-array-list' as const, params: { modelKey: cfg.key } }
      : { name: 'jsonadmin-array-create' as const, params: { modelKey: cfg.key } }
    return [{
      label: cfg.label,
      icon: cfg.icon || getIconForLabel(cfg.label),
      kind: 'array' as const,
      to,
      createPath: (canList && canCreate) ? cfg.create.route : undefined,
      searchPlaceholder: (canList && cfg.list.enableSearch) ? cfg.list.searchPlaceholder : undefined,
    }]
  })
  return meta
})
