<script setup lang="ts">
import type { ListFieldType } from '../utils/list'
import { useRouteQuery } from '@vueuse/router'

const _props = defineProps<{
  filters: { field: string, label?: string, type?: ListFieldType, options?: { label?: string, value: string | number, count?: number }[] }[]
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

// Create computed property for individual filter field
function getFilterModel(filter: { field: string, type?: string }) {
  return computed({
    get: () => {
      if (filter.type === 'boolean') {
        return filterQuery.value[filter.field] || 'all'
      } else {
        return filterQuery.value[filter.field] || ''
      }
    },
    set: (value: string) => {
      const current = { ...filterQuery.value }

      if (value === null || value === '' || value === 'all') {
        delete current[filter.field]
      } else {
        current[filter.field] = value
      }

      filterQuery.value = current
    },
  })
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

const normalizeOptions = (options: { label?: string, value: string | number, count?: number }[] | string[]) => {
  return options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option }
    }
    return { label: option.label || option.value?.toString(), value: option.value, count: option.count }
  })
}
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
          v-model="getFilterModel(filter).value"
          class="min-w-20"
          size="xs"
          :items="booleanOptions"
        />

        <USelectMenu
          v-else-if="(filter.type === 'text' || !filter.type) && filter.options"
          v-model="getFilterModel(filter).value"
          class="min-w-32"
          size="xs"
          value-key="value"
          :items="normalizeOptions(filter.options)"
          :placeholder="`${filter.label}`"
        >
          <template #item-label="{ item }">
            {{ item.label || item.value }}
          </template>
          <template #item-trailing="{ item }">
            <span v-if="item.count" class="text-xs text-gray-500">( {{ item.count }} )</span>
          </template>
        </USelectMenu>
        <UInput
          v-else-if="filter.type === 'date'"
          v-model="getFilterModel(filter).value"
          class="min-w-32"
          size="xs"
          type="date"
          :placeholder="`Filter ${filter.label}`"
        />

        <!-- Default fallback -->
        <UInput
          v-else
          v-model="getFilterModel(filter).value"
          class="min-w-32"
          size="xs"
          :placeholder="`Filter ${filter.label}`"
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
