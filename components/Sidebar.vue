<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { toTitleCase } from '~/utils/string'

const iconMap: Record<string, string> = {
  user: 'user',
  profile: 'user-circle',

  product: 'box',
  item: 'package',

  order: 'receipt',
  purchase: 'shopping-cart',

  invoice: 'file-text',

  payment: 'credit-card',
  transaction: 'dollar-sign',

  category: 'layers',
  collection: 'folder',

  tag: 'tag',

  role: 'shield',
  permission: 'key',
  group: 'users',

  file: 'file',
  media: 'image',
  image: 'image',
  document: 'file-text',
  attachment: 'paperclip',

  setting: 'settings',
  preference: 'sliders',

  log: 'scroll',
  activity: 'activity',
  audit: 'list',

  notification: 'bell',
  message: 'message-circle',
  comment: 'message-square',
  chat: 'message-circle',

  location: 'map-pin',
  address: 'map',

  platform: 'monitor',
  device: 'smartphone',

  feedback: 'message-circle',
  contact: 'phone',

  subscription: 'repeat',
  plan: 'calendar',

  campaign: 'megaphone',

  report: 'bar-chart',
  stat: 'pie-chart',
  metric: 'gauge',

  schedule: 'calendar-clock',
  task: 'check-square',
  todo: 'list-todo',

  team: 'users',
  member: 'user',

  job: 'briefcase',
  career: 'briefcase',

  ticket: 'ticket',

  faq: 'help-circle',

  blog: 'pen-line',
  post: 'file-text',
  article: 'newspaper',

  banner: 'image',
  ad: 'badge-dollar-sign',

  seo: 'search',
  sitemap: 'sitemap',
}

function getIconForModel(name: string): string {
  const singular = toSingular(name.toLowerCase())
  return iconMap[singular] ?? 'database'
}

// Naive plural → singular converter
function toSingular(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

const appConfig = useAppConfig()
const allModels = useAdminRegistry().all()
const collapsed = ref(false)

const modelLinks = allModels.map(model => ({
  label: toTitleCase(model.label),
  icon: `i-lucide-${getIconForModel(model.label)}`,
  to: { name: 'autoadmin-list', params: { modelLabel: `${model.label}` } },
  type: 'link' as const,
}))

const items = ref<NavigationMenuItem[][]>([
  [
    appConfig.sidebar.modelLabel,
    ...modelLinks,
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
