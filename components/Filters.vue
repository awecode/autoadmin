<script setup lang="ts">
import type { ListFieldType } from '../utils/list'
import { useRouteQuery } from '@vueuse/router'

const _props = defineProps<{
  filters: { field: string, label?: string, type?: ListFieldType, options?: { label?: string, value: string | number }[] }[]
}>()

const route = useRoute()
const router = useRouter()

// Manage filter state via URL query parameters
const filterQuery = useRouteQuery('filters', '', {
  route,
  router,
  transform: {
    get(value: string) {
      if (!value) {
        return {}
      }
      return Object.fromEntries(value.split(';').map(item => item.split(':'))) as Record<string, string>
    },
    set(value: Record<string, string>) {
      return Object.entries(value).map(([key, val]) => `${key}:${val}`).join(';')
    },
  },
})

// Update filter value
function updateFilter(field: string, value: string | null) {
  const current = { ...filterQuery.value }

  if (value === null || value === '' || value === 'all') {
    delete current[field]
  } else {
    current[field] = value
  }

  filterQuery.value = current
}

// Get filter value
function getFilterValue(field: string): string {
  return filterQuery.value[field] || 'all'
}

// Clear all filters
function clearAllFilters() {
  filterQuery.value = {}
}

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return Object.keys(filterQuery.value).length > 0
})

// Boolean filter options
const booleanOptions = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]
</script>

<template>
  <div v-if="filters && filters.length > 0" class="flex items-center gap-2">
    <div class="flex items-center gap-2">
      <UIcon class="h-4 w-4 text-gray-500" name="i-heroicons-funnel" />
      <span class="text-sm font-medium text-gray-700">Filters:</span>
    </div>

    <div class="flex items-center gap-2">
      <div v-for="filter in filters" :key="filter.field" class="flex items-center gap-1">
        <span class="text-sm text-gray-600">{{ filter.label }}</span>
        <!-- Boolean Filter -->
        <USelect
          v-if="filter.type === 'boolean'"
          class="min-w-20"
          size="xs"
          :items="booleanOptions"
          :model-value="getFilterValue(filter.field)"
          @update:model-value="updateFilter(filter.field, $event as string)"
        />

        <UInput
          v-else-if="filter.type === 'text' || !filter.type"
          class="min-w-32"
          size="xs"
          :model-value="getFilterValue(filter.field)"
          :placeholder="`Filter ${filter.label}`"
          @update:model-value="updateFilter(filter.field, $event as string)"
        />

        <!-- Number Filter -->
        <UInput
          v-else-if="filter.type === 'number'"
          class="min-w-24"
          size="xs"
          type="number"
          :model-value="getFilterValue(filter.field)"
          :placeholder="`Filter ${filter.label}`"
          @update:model-value="updateFilter(filter.field, $event as string)"
        />

        <!-- Date Filter -->
        <UInput
          v-else-if="filter.type === 'date'"
          class="min-w-32"
          size="xs"
          type="date"
          :model-value="getFilterValue(filter.field)"
          @update:model-value="updateFilter(filter.field, $event as string)"
        />

        <!-- DateTime Filter -->
        <UInput
          v-else-if="filter.type === 'datetime-local'"
          class="min-w-40"
          size="xs"
          type="datetime-local"
          :model-value="getFilterValue(filter.field)"
          @update:model-value="updateFilter(filter.field, $event as string)"
        />

        <!-- Default fallback -->
        <UInput
          v-else
          class="min-w-32"
          size="xs"
          :model-value="getFilterValue(filter.field)"
          :placeholder="`Filter ${filter.label}`"
          @update:model-value="updateFilter(filter.field, $event as string)"
        />
      </div>
    </div>

    <!-- Clear all filters button -->
    <UButton
      v-if="hasActiveFilters"
      color="neutral"
      icon="i-heroicons-x-mark"
      size="xs"
      variant="ghost"
      @click="clearAllFilters"
    >
      Clear
    </UButton>
  </div>
</template>
