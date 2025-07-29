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

// Clear all filters
function clearAllFilters() {
  filterQuery.value = {}
}

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return Object.keys(filterQuery.value).length > 0
})

// Mobile drawer state
const mobileFiltersOpen = ref(false)

// Boolean filter options
const booleanOptions = [
  { value: null, label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]
</script>

<template>
  <template v-if="filters && filters.length > 0">
    <!-- Desktop: Show all filters inline -->
    <template v-if="filters.length === 1">
      <div v-for="filter in filters" :key="filter.field">
        <div class="text-sm text-dimmed mb-1">
          {{ filter.label }}
        </div>
        <!-- Boolean Filter -->
        <USelect
          v-if="filter.type === 'boolean'"
          v-model="getFilterModel(filter).value"
          class="min-w-24"
          placeholder="All"
          :items="booleanOptions"
        />

        <USelectMenu
          v-else-if="(filter.type === 'text' || filter.type === 'select' || !filter.type) && filter.options"
          v-model="getFilterModel(filter).value"
          class="min-w-32"
          placeholder="All"
          value-key="value"
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
          class="min-w-32"
          placeholder="All"
        />
      </div>

      <!-- Clear all filters button -->
      <UButton
        v-if="hasActiveFilters"
        class="self-end"
        color="neutral"
        icon="i-lucide-x"
        size="xs"
        variant="soft"
        @click="clearAllFilters"
      >
        Clear
      </UButton>
    </template>

    <!-- Multiple filters: Desktop shows inline, Mobile shows button -->
    <template v-else>
      <!-- Desktop: Show all filters inline -->
      <template v-for="filter in filters" :key="`desktop-${filter.field}`">
        <div class="hidden md:block">
          <div class="text-sm text-dimmed mb-1">
            {{ filter.label }}
          </div>
          <!-- Boolean Filter -->
          <USelect
            v-if="filter.type === 'boolean'"
            v-model="getFilterModel(filter).value"
            class="min-w-24"
            placeholder="All"
            :items="booleanOptions"
          />

          <USelectMenu
            v-else-if="(filter.type === 'text' || filter.type === 'select' || !filter.type) && filter.options"
            v-model="getFilterModel(filter).value"
            class="min-w-32"
            placeholder="All"
            value-key="value"
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
            class="min-w-32"
            placeholder="All"
          />
        </div>
      </template>

      <!-- Desktop: Clear all filters button -->
      <UButton
        v-if="hasActiveFilters"
        class="hidden md:block self-end"
        color="neutral"
        icon="i-lucide-x"
        size="xs"
        variant="soft"
        @click="clearAllFilters"
      >
        Clear
      </UButton>

      <!-- Mobile: Filters button -->
      <div class="md:hidden">
        <div class="text-sm text-dimmed mb-1">
          Filters
        </div>
        <UButton
          color="neutral"
          icon="i-lucide-filter"
          variant="outline"
          @click="mobileFiltersOpen = true"
        >
          Filters
          <span v-if="hasActiveFilters" class="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">
            {{ Object.keys(filterQuery).length }}
          </span>
        </UButton>
      </div>

      <!-- Mobile: Filters Drawer -->
      <Teleport to="body">
        <!-- Overlay -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-50"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-50"
          leave-to-class="opacity-0"
        >
          <div
            v-if="mobileFiltersOpen"
            class="md:hidden fixed inset-0 bg-black opacity-50 z-40"
            @click="mobileFiltersOpen = false"
          ></div>
        </Transition>

        <!-- Drawer -->
        <Transition
          enter-active-class="transition-transform duration-300 ease-out"
          enter-from-class="translate-y-full"
          enter-to-class="translate-y-0"
          leave-active-class="transition-transform duration-250 ease-in"
          leave-from-class="translate-y-0"
          leave-to-class="translate-y-full"
        >
          <div
            v-if="mobileFiltersOpen"
            class="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 max-h-[80vh] overflow-y-auto"
          >
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 class="text-lg font-semibold">
                Filters
              </h3>
              <UButton
                color="neutral"
                icon="i-lucide-x"
                variant="ghost"
                @click="mobileFiltersOpen = false"
              />
            </div>

            <!-- Filter Content -->
            <div class="p-4 space-y-4">
              <div v-for="filter in filters" :key="`mobile-${filter.field}`" class="space-y-2">
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ filter.label }}
                </div>

                <!-- Boolean Filter -->
                <USelect
                  v-if="filter.type === 'boolean'"
                  v-model="getFilterModel(filter).value"
                  class="w-full"
                  placeholder="All"
                  :items="booleanOptions"
                />

                <USelectMenu
                  v-else-if="(filter.type === 'text' || filter.type === 'select' || !filter.type) && filter.options"
                  v-model="getFilterModel(filter).value"
                  class="w-full"
                  placeholder="All"
                  value-key="value"
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
                  class="w-full"
                  placeholder="All"
                />
              </div>

              <!-- Clear all filters button -->
              <div v-if="hasActiveFilters" class="flex justify-center pt-4">
                <UButton
                  color="neutral"
                  icon="i-lucide-x"
                  variant="soft"
                  @click="clearAllFilters"
                >
                  Clear All Filters
                </UButton>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>
  </template>
</template>
