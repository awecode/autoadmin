import type { AutoadminJsonAdminTakeoverMode } from '#layers/autoadmin/utils/jsonAdminApiPrefix'
import type { JsonAdminRegistryLink } from '#layers/autoadmin/utils/jsonAdminRegistryMeta'
import type { NavigationMenuItem } from '@nuxt/ui'
import type { MaybeRefOrGetter } from 'vue'
import { getIconForLabel } from '#layers/autoadmin/utils/string'
import { computed, toValue } from 'vue'

interface PublicAutoadminJsonadmin {
  linkLabel?: string
  linkIcon?: string
  injectSidebar?: boolean
  showDashboardCard?: boolean
  takeoverMode?: AutoadminJsonAdminTakeoverMode
}

/**
 * JSON-admin nav and dashboard policy (sidebar injection, dashboard card, takeover).
 * Pass the same `useFetch` results as elsewhere (`model-links`, `json-admin-registry-meta`) for deduplication.
 */
export function useAutoadminJsonAdminUi(
  drizzleLinks: MaybeRefOrGetter<Array<{ label: string }> | null | undefined>,
  jsonLinks: MaybeRefOrGetter<JsonAdminRegistryLink[] | null | undefined>,
) {
  const runtimeConfig = useRuntimeConfig()
  const ui = computed(() => {
    const pub = runtimeConfig.public as { autoadmin?: { jsonadmin?: PublicAutoadminJsonadmin } }
    const c = pub.autoadmin?.jsonadmin ?? {}
    return {
      linkLabel: c.linkLabel ?? 'Configuration',
      linkIcon: c.linkIcon ?? 'i-lucide-settings-2',
      injectSidebar: c.injectSidebar !== false,
      showDashboardCard: c.showDashboardCard !== false,
      takeoverMode: (c.takeoverMode ?? 'auto') as AutoadminJsonAdminTakeoverMode,
    }
  })

  const linkLabel = computed(() => ui.value.linkLabel)
  const linkIcon = computed(() => ui.value.linkIcon)

  const drizzleEmpty = computed(() => !(toValue(drizzleLinks)?.length))
  const jsonNonEmpty = computed(() => (toValue(jsonLinks)?.length ?? 0) > 0)

  const takeoverActive = computed(() => {
    const mode = ui.value.takeoverMode
    if (mode === 'always') {
      return true
    }
    if (mode === 'never') {
      return false
    }
    return drizzleEmpty.value && jsonNonEmpty.value
  })

  const shouldInjectSidebarLink = computed(() => {
    if (takeoverActive.value) {
      return false
    }
    if (!ui.value.injectSidebar) {
      return false
    }
    return jsonNonEmpty.value
  })

  const shouldShowDashboardCard = computed(() => {
    if (takeoverActive.value) {
      return false
    }
    if (!ui.value.showDashboardCard) {
      return false
    }
    return jsonNonEmpty.value
  })

  const jsonNavItems = computed<NavigationMenuItem[]>(() => {
    return (toValue(jsonLinks) ?? []).map(link => ({
      label: link.label,
      icon: (link.icon || getIconForLabel(link.label)) as string,
      to: link.to,
      type: 'link' as const,
    }))
  })

  /** Middle `UNavigationMenu` group when JSON admin has taken over the sidebar. */
  const takeoverMiddleItems = computed<NavigationMenuItem[]>(() => {
    const items = jsonNavItems.value
    if (items.length > 0) {
      return items
    }
    return [{
      label: ui.value.linkLabel,
      type: 'label' as const,
    }]
  })

  const configurationNavItem = computed<NavigationMenuItem>(() => ({
    label: ui.value.linkLabel,
    icon: ui.value.linkIcon,
    to: { name: 'jsonadmin-index' },
    type: 'link' as const,
  }))

  return {
    linkLabel,
    linkIcon,
    takeoverActive,
    shouldInjectSidebarLink,
    shouldShowDashboardCard,
    jsonNavItems,
    takeoverMiddleItems,
    configurationNavItem,
  }
}
