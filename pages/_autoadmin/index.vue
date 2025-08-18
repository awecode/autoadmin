<script setup lang="ts">
import SearchModal from '#layers/autoadmin/components/SearchModal.vue'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'

const searchModal = useOverlay().create(SearchModal)

const { data: modelLinks } = await useAsyncData('model-links', () => $fetch('/api/autoadmin/registry-meta'))

function openSearchModal(link: NonNullable<typeof modelLinks.value>[number]) {
  if (link.searchPlaceholder) {
    searchModal.open({
      label: link.label,
      searchPlaceholder: link.searchPlaceholder,
      to: link.to,
      close: searchModal.close,
    })
  }
}

const title = getAdminTitle()

useHead({
  title: `Dashboard | ${title}`,
})
</script>

<template>
  <AutoAdmin>
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
                class="w-8 h-8 text-gray-600 dark:text-gray-400 transition-colors duration-200"
                :name="link.icon || 'i-lucide-database'"
              />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ link.label }}
              </span>
            </div>
          </UCard>
        </NuxtLink>
        <!-- Action buttons -->
        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex gap-1">
          <!-- Search button -->
          <UTooltip v-if="link.searchPlaceholder" text="Search" :delay="0">
            <UButton
              square
              color="neutral"
              icon="i-lucide-search"
              size="xs"
              variant="ghost"
              @click.prevent="openSearchModal(link)"
            />
          </UTooltip>

          <!-- Plus button for adding new instance -->
          <UTooltip v-if="link.createPath" text="Add new" :delay="0">
            <NuxtLink
              v-if="link.createPath"
              :to="link.createPath"
            >
              <UButton
                square
                color="neutral"
                icon="i-lucide-plus"
                size="xs"
                variant="ghost"
              />
            </NuxtLink>
          </UTooltip>
        </div>
      </div>
    </div>
  </AutoAdmin>
</template>
