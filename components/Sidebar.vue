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
  [
    appConfig.sidebar.modelLabel,
    ...modelLinks.value,
  ],
  appConfig.sidebar.additionalItems,
])
</script>

<template>
  <div class="relative">
    <UNavigationMenu
      class="data-[orientation=vertical]:w-48"
      orientation="vertical"
      :collapsed="collapsed"
      :items="items"
    />

    <!-- Collapse/Uncollapse button -->
    <UButton
      square
      class="absolute top-4 right-4 z-10"
      size="sm"
      variant="ghost"
      :icon="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'"
      @click="collapsed = !collapsed"
    />
  </div>
</template>
