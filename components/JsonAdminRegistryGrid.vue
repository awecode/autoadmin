<script setup lang="ts">
import type { JsonAdminRegistryLink } from '#layers/autoadmin/utils/jsonAdminRegistryMeta'
import { getIconForLabel } from '#layers/autoadmin/utils/string'

withDefaults(defineProps<{
  links: JsonAdminRegistryLink[] | null | undefined
  /** When set, shows an `<h1>` above the grid (e.g. Configuration index). */
  pageTitle?: string
  /** Copy for the empty-state alert when `links` is empty. */
  emptyDescription: string
}>(), {
  pageTitle: undefined,
})
</script>

<template>
  <div>
    <div
      v-if="pageTitle"
      class="mb-8"
    >
      <h1 class="text-2xl font-semibold">
        {{ pageTitle }}
      </h1>
    </div>

    <div class="grid grid-cols-2! md:grid-cols-3! lg:grid-cols-4! gap-4">
      <NuxtLink
        v-for="link in links ?? []"
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
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <UAlert
      v-if="links && links.length === 0"
      class="mt-8"
      color="neutral"
      title="No JSON resources registered"
      :description="emptyDescription"
    />
  </div>
</template>
