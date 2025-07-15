<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const modelLinks = useState<NavigationMenuItem[]>('modelLinks', () => [])
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-none">
    <div class="flex gap-4">
      <div>
        <Sidebar />
      </div>
      <div class="flex-1">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <NuxtLink
            v-for="link in modelLinks"
            :key="link.label"
            class="group"
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
        </div>
      </div>
    </div>
  </div>
</template>
