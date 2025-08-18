import { getIconForLabel } from '#layers/autoadmin/utils/string'

export default defineEventHandler(async () => {
  const registry = useAdminRegistry()
  const allCfg = registry.all()
  const meta = allCfg.filter(cfg => cfg.enableIndex).map(cfg => ({
    label: cfg.label,
    icon: cfg.icon || getIconForLabel(cfg.label),
    to: { name: 'autoadmin-list', params: { modelKey: cfg.key } },
    type: 'link' as const,
    createPath: cfg.create.enabled ? { name: 'autoadmin-create', params: { modelKey: cfg.key } } : undefined,
    searchPlaceholder: cfg.list.enableSearch ? cfg.list.searchPlaceholder : undefined,
  }))
  return meta
})
