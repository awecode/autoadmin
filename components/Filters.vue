<script setup lang="ts">
import type { FilterSpec } from '#layers/autoadmin/server/utils/filter'
import { normalizeOptions } from '#layers/autoadmin/utils/form'
import { useRouteQuery } from '@vueuse/router'

defineProps<{
  filters: FilterSpec[]
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

// Mobile drawer state
const mobileFiltersOpen = ref(false)

// Clear all filters
function clearAllFilters() {
  filterQuery.value = {}
  mobileFiltersOpen.value = false
}

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return Object.keys(filterQuery.value).length > 0
})

// Boolean filter options
const booleanOptions = [
  { value: null, label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]
</script>

<template>
  <template v-if="filters && filters.length > 0">
    <!-- Mobile filters button (only for multiple filters) -->
    <div v-if="filters.length > 1" class="md:hidden">
      <UButton
        class="text-dimmed"
        color="neutral"
        icon="i-lucide-filter"
        variant="outline"
        @click="mobileFiltersOpen = true"
      >
        Filters
        <span v-if="hasActiveFilters" class="ml-1 text-xs bg-primary text-white rounded-full px-1.5 py-0.5">
          {{ Object.keys(filterQuery).length }}
        </span>
      </UButton>
    </div>

    <!-- Single set of filters - responsive visibility based on filter count -->
    <div :class="filters.length === 1 ? 'contents' : (mobileFiltersOpen ? 'fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 z-50 p-4 border-t border-gray-200 dark:border-gray-800 max-h-[80vh] overflow-y-auto md:static md:bg-transparent md:z-auto md:p-0 md:border-0 md:max-h-none md:overflow-visible' : 'hidden md:contents')">
      <div v-if="mobileFiltersOpen && filters.length > 1" class="md:hidden flex items-center justify-between mb-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div class="flex gap-2">
          <h3 class="text-lg font-semibold">
            Filters
          </h3>
          <UButton
            v-if="hasActiveFilters"
            color="neutral"
            icon="i-lucide-rotate-ccw"
            size="xs"
            variant="soft"
            @click="clearAllFilters"
          >
            Clear Filters
          </UButton>
        </div>
        <UButton
          color="neutral"
          icon="i-lucide-x"
          variant="soft"
          @click="mobileFiltersOpen = false"
        />
      </div>

      <!-- Filter elements rendered once -->
      <div :class="mobileFiltersOpen ? 'space-y-4' : 'contents'">
        <template v-for="filter in filters" :key="filter.field">
          <div :class="mobileFiltersOpen ? 'space-y-2' : ''">
            <div :class="mobileFiltersOpen ? 'text-sm font-medium text-gray-700 dark:text-gray-300' : 'text-sm text-dimmed mb-1'">
              {{ filter.label }}
            </div>

            <!-- Boolean Filter -->
            <USelect
              v-if="filter.type === 'boolean'"
              v-model="getFilterModel(filter).value"
              placeholder="All"
              :class="mobileFiltersOpen ? 'w-full' : 'min-w-24'"
              :items="booleanOptions"
            />

            <USelectMenu
              v-else-if="(filter.type === 'text' || filter.type === 'select' || !filter.type) && filter.options"
              v-model="getFilterModel(filter).value"
              placeholder="All"
              value-key="value"
              :class="mobileFiltersOpen ? 'w-full' : 'min-w-32'"
              :items="normalizeOptions(filter.options)"
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
              placeholder="Select Dates"
            />

            <DatePicker
              v-else-if="filter.type === 'date'"
              v-model="getFilterModel(filter).value"
              placeholder="Select a Date"
            />

            <!-- Default fallback -->
            <UInput
              v-else
              v-model="getFilterModel(filter).value"
              placeholder="All"
              :class="mobileFiltersOpen ? 'w-full' : 'min-w-32'"
            />
          </div>
        </template>

        <!-- Clear button -->
        <UButton
          v-if="hasActiveFilters && !mobileFiltersOpen"
          class="self-end"
          color="neutral"
          icon="i-lucide-x"
          size="xs"
          variant="soft"
          @click="clearAllFilters"
        >
          Clear
        </UButton>
      </div>
    </div>

    <!-- Mobile overlay (only for multiple filters) -->
    <div
      v-if="mobileFiltersOpen && filters.length > 1"
      class="md:hidden fixed inset-0 bg-black opacity-50 z-40"
      @click="mobileFiltersOpen = false"
    ></div>
  </template>
</template>
