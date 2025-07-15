<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { getIconForLabel, toTitleCase } from '~/utils/string'

const modelLinks = useState<NavigationMenuItem[]>('modelLinks', () => [])

const appConfig = useAppConfig()
const allModels = useAdminRegistry().all()
const collapsed = ref(false)

await callOnce(async () => {
  const links = allModels.map(model => ({
    label: toTitleCase(model.label),
    icon: `i-lucide-${getIconForLabel(model.label)}`,
    to: { name: 'autoadmin-list', params: { modelLabel: `${model.label}` } },
    type: 'link' as const,
  }))
  modelLinks.value = links
})

const items = ref<NavigationMenuItem[][]>([
  appConfig.sidebar.topItems,
  [
    appConfig.sidebar.modelLabel,
    ...modelLinks.value,
  ],
  appConfig.sidebar.additionalItems,
])
</script>

<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-800 py-4" :class="{ 'px-4': !collapsed }">
    <div class="flex justify-between items-center mb-4">
      <div v-if="!collapsed" class="text-lg font-bold">
        AutoAdmin
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        :class="{ 'mx-auto': collapsed }"
        :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        :title="collapsed ? 'Expand' : 'Collapse'"
        @click="collapsed = !collapsed"
      />
    </div>
    <div>
      <UNavigationMenu
        popover
        tooltip
        class="data-[orientation=vertical]:w-48 gap-4"
        orientation="vertical"
        :class="{ 'data-[orientation=vertical]:w-12 items-center': collapsed }"
        :collapsed="collapsed"
        :items="items"
      />
    </div>
  </div>
</template>
