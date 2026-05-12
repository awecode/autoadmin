import { getIconForLabel } from '#layers/autoadmin/utils/string'
import { getAllowedActions } from '../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const registry = useAdminRegistry()
  const allCfg = registry.all()
  const meta = allCfg.flatMap((cfg) => {
    if (!cfg.enableIndex) {
      return []
    }
    const allowed = getAllowedActions(event, { roles: cfg.roles })
    const canList = allowed.list
    const canCreate = cfg.create.enabled && allowed.create
    // Drop entries with no usable nav target.
    if (!canList && !canCreate) {
      return []
    }
    // Primary target falls back to the create page for create-only roles.
    const to = canList
      ? { name: 'autoadmin-list' as const, params: { modelKey: cfg.key } }
      : { name: 'autoadmin-create' as const, params: { modelKey: cfg.key } }
    return [{
      label: cfg.label,
      icon: cfg.icon || getIconForLabel(cfg.label),
      to,
      type: 'link' as const,
      // Redundant "+ Add new" affordance when the card already opens the create page.
      createPath: (canList && canCreate) ? cfg.create.route : undefined,
      // Search navigates to `to` with a query; only meaningful when `to` is the list page.
      searchPlaceholder: (canList && cfg.list.enableSearch) ? cfg.list.searchPlaceholder : undefined,
    }]
  })
  return meta
})
