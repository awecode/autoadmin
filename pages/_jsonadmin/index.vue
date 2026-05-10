<script setup lang="ts">
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'
import { getIconForLabel } from '#layers/autoadmin/utils/string'

interface JsonRegistryLink {
  label: string
  icon?: string
  kind: 'object' | 'array'
  to: { name: string, params: { modelKey: string } }
  createPath?: { name: string, params: { modelKey: string } }
  searchPlaceholder?: string
}

const { data: links, error } = await useFetch<JsonRegistryLink[]>('/api/autoadmin/json/registry-meta', {
  key: 'json-admin-registry-meta',
  headers: {
    referer: useRequestURL().pathname,
  },
})

if (error.value?.data?.data?.redirect) {
  navigateTo(error.value.data.data.redirect)
}

useHead({
  title: `Configuration | ${getAdminTitle()}`,
})
</script>

<template>
  <AutoAdmin>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">
        Configuration
      </h1>
    </div>

    <div class="grid grid-cols-2! md:grid-cols-3! lg:grid-cols-4! gap-4">
      <NuxtLink
        v-for="link in links"
        :key="link.label + link.kind"
        class="block"
        :to="link.to"
      >
        <UCard class="hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-200 cursor-pointer h-full">
          <div class="flex flex-col items-center text-center space-y-3 p-2">
            <UIcon
              class="w-8 h-8 text-neutral-600 dark:text-neutral-400"
              :name="link.icon || getIconForLabel(link.label)"
            />
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ link.label }}
            </span>
            <!-- <UBadge color="neutral" variant="subtle" size="sm">
              {{ link.kind === 'object' ? 'Object' : 'Array' }}
            </UBadge> -->
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <UAlert
      v-if="links && links.length === 0"
      class="mt-8"
      color="neutral"
      title="No JSON resources registered"
      description="Add a server plugin that calls useJsonResourceRegistry().register(...). See README (JSON admin section)."
    />
  </AutoAdmin>
</template>
