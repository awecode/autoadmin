import { getIconForLabel } from '#layers/autoadmin/utils/string'
import { getAllowedActions } from '../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const registry = useAdminRegistry()
  const allCfg = registry.all()
  const meta = allCfg.filter(cfg => cfg.enableIndex).map((cfg) => {
    const allowed = getAllowedActions(event, { roles: cfg.roles })
    return {
      label: cfg.label,
      icon: cfg.icon || getIconForLabel(cfg.label),
      to: { name: 'autoadmin-list', params: { modelKey: cfg.key } },
      type: 'link' as const,
      createPath: (cfg.create.enabled && allowed.create) ? cfg.create.route : undefined,
      searchPlaceholder: cfg.list.enableSearch ? cfg.list.searchPlaceholder : undefined,
    }
  })
  return meta
})
