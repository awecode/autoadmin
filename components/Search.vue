<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'

withDefaults(defineProps<{
  placeholder?: string
  showLabel?: boolean
  label?: string
}>(), {
  placeholder: 'Search ...',
  showLabel: false,
})

const route = useRoute()
const router = useRouter()

const search = useRouteQuery('q', '', { route, router })
</script>

<template>
  <div>
    <div v-if="showLabel || label" class="text-sm text-dimmed mb-1">
      {{ label || 'Search' }}
    </div>
    <UInput
      v-model="search"
      class="max-w-xl"
      color="neutral"
      :placeholder="placeholder"
    />
  </div>
</template>
