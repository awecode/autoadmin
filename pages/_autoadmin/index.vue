<script setup lang="ts">
import { getTitle } from '~/utils/autoadmin'
import { getIconForLabel, toTitleCase } from '~/utils/string'

const modelLinks = useState('model-links', () => {
  const allCfg = useAdminRegistry().all()
  const links = allCfg.filter(cfg => cfg.enableIndex).map(cfg => ({
    label: toTitleCase(cfg.label),
    icon: cfg.icon || getIconForLabel(cfg.label),
    to: { name: 'autoadmin-list', params: { modelLabel: `${cfg.label}` } },
    type: 'link' as const,
    createPath: cfg.create?.enabled ? { name: 'autoadmin-create', params: { modelLabel: `${cfg.label}` } } : undefined,
  }))

  return links
})

const title = getTitle()

useHead({
  title: `Dashboard | ${title}`,
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-none">
    <div class="flex gap-4">
      <div>
        <Sidebar />
      </div>
      <div class="flex-1">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div
            v-for="link in modelLinks"
            :key="link.label"
            class="group relative"
          >
            <!-- Main card as link to list view -->
            <NuxtLink
              class="block"
              :to="link.to"
            >
              <UCard class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 cursor-pointer h-full">
                <div class="flex flex-col items-center text-center space-y-3 p-2">
                  <UIcon
                    class="w-8 h-8 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200"
                    :name="link.icon || 'i-lucide-database'"
                  />
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200">
                    {{ link.label }}
                  </span>
                </div>
              </UCard>
            </NuxtLink>
            <!-- Plus button for adding new instance -->
            <UTooltip v-if="link.createPath" text="Add new" :delay="0">
              <NuxtLink
                v-if="link.createPath"
                class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                :to="link.createPath"
              >
                <UButton
                  square
                  color="primary"
                  icon="i-lucide-plus"
                  size="xs"
                  variant="ghost"
                />
              </NuxtLink>
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
