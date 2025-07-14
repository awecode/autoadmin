<script setup lang="ts">
import type { FilterType } from '#layers/autoadmin/utils/filter'
import { normalizeOptions } from '#layers/autoadmin/utils/form'
import { useRouteQuery } from '@vueuse/router'

const _props = defineProps<{
  filters: { field: string, label?: string, type?: FilterType, options?: { label?: string, value: string | number, count?: number }[] }[]
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

      if (value === null || value === '' || value === undefined) {
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

        <RelationSelectMenu
          v-else-if="filter.type === 'relation'"
          v-model="getFilterModel(filter).value"
          :filter="filter"
        />

        <!-- Date Range Filter -->
        <DateRangePicker
          v-else-if="filter.type === 'daterange'"
          v-model="getFilterModel(filter).value"
          :placeholder="`Select ${filter.label || 'Date Range'}`"
        />

        <DatePicker
          v-else-if="filter.type === 'date'"
          v-model="getFilterModel(filter).value"
          :placeholder="`Select ${filter.label || 'Date Range'}`"
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
