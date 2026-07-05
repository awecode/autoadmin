<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'

const props = withDefaults(defineProps<{
  placeholder?: string
  showLabel?: boolean
  label?: string
  debounceMs?: number
}>(), {
  placeholder: 'Search ...',
  showLabel: false,
  debounceMs: 300,
})

const route = useRoute()
const router = useRouter()

const routeSearch = useRouteQuery<string>('q', '', { route, router })
const routePage = useRouteQuery('page', undefined, { route, router })
const searchInput = ref(String(routeSearch.value ?? ''))

// input -> route (debounced), route -> input (immediate, e.g. back/forward nav)
watchDebounced(searchInput, (value) => {
  const trimmed = value.trim()
  if (trimmed === routeSearch.value)
    return
  routeSearch.value = trimmed
  // A new search invalidates the current pagination; go back to page 1
  routePage.value = undefined
}, { debounce: () => props.debounceMs })
watch(routeSearch, value => searchInput.value = String(value ?? ''))
</script>

<template>
  <div>
    <div v-if="showLabel || label" class="text-sm text-dimmed mb-1">
      {{ label || 'Search' }}
    </div>
    <UInput
      v-model="searchInput"
      class="max-w-xl"
      color="neutral"
      type="search"
      :placeholder="placeholder"
    />
  </div>
</template>
