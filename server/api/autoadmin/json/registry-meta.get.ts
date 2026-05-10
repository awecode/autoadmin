import { getIconForLabel } from '#layers/autoadmin/utils/string'
import { useJsonResourceRegistry } from '../../../utils/jsonResourceRegistry'

export default defineEventHandler(async () => {
  const reg = useJsonResourceRegistry()
  const meta = reg.all()
    .filter(cfg => cfg.enableIndex)
    .map((cfg) => {
      if (cfg.kind === 'object') {
        return {
          label: cfg.label,
          icon: cfg.icon || getIconForLabel(cfg.label),
          kind: 'object' as const,
          to: { name: 'jsonadmin-object-edit', params: { modelKey: cfg.key } },
          createPath: undefined,
          searchPlaceholder: undefined,
        }
      }
      return {
        label: cfg.label,
        icon: cfg.icon || getIconForLabel(cfg.label),
        kind: 'array' as const,
        to: { name: 'jsonadmin-array-list', params: { modelKey: cfg.key } },
        createPath: cfg.create.enabled ? cfg.create.route : undefined,
        searchPlaceholder: cfg.list.enableSearch ? cfg.list.searchPlaceholder : undefined,
      }
    })
  return meta
})
