<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { getTitle } from '#layers/autoadmin/utils/autoadmin'
import { getIconForLabel, toTitleCase } from '#layers/autoadmin/utils/string'

const appConfig = useAppConfig()

const collapsed = useCookie<boolean>('sidebar-collapsed', {
  default: () => false,
  sameSite: true,
  httpOnly: false,
})

const items = useState<NavigationMenuItem[][]>('sidebar-items', () => {
  const allModels = useAdminRegistry().all()
  const links = allModels.filter(model => model.enableIndex).map(model => ({
    label: toTitleCase(model.label),
    icon: model.icon || getIconForLabel(model.label),
    to: { name: 'autoadmin-list', params: { modelLabel: `${model.label}` } },
    type: 'link' as const,
  }))

  return [
    appConfig.sidebar.topItems,
    [
      appConfig.sidebar.modelLabel,
      ...links,
    ],
    appConfig.sidebar.additionalItems,
  ]
})
</script>

<template>
  <div
    class="rounded-lg border border-gray-200 dark:border-gray-800 py-4 transition-all duration-300 ease-in-out"
    :class="{ 'px-4': !collapsed }"
  >
    <div class="flex justify-between items-center mb-4 transition-all duration-300 ease-in-out">
      <div
        v-if="!collapsed"
        class="text-lg font-bold transition-opacity duration-300 ease-in-out"
      >
        {{ getTitle() }}
      </div>
      <UTooltip :delay="0" :text="collapsed ? 'Expand' : 'Collapse'">
        <UButton
          class="transition-all duration-300 ease-in-out"
          color="neutral"
          variant="ghost"
          :class="{ 'mx-auto': collapsed }"
          :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          @click="collapsed = !collapsed"
        />
      </UTooltip>
    </div>
    <div class="transition-all duration-300 ease-in-out">
      <UNavigationMenu
        popover
        tooltip
        class="data-[orientation=vertical]:w-48 gap-4 transition-all duration-300 ease-in-out"
        orientation="vertical"
        :class="{ 'data-[orientation=vertical]:w-12 items-center': collapsed }"
        :collapsed="collapsed"
        :items="items"
      />
    </div>
  </div>
</template>
