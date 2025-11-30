<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'

withDefaults(defineProps<{
  placeholder?: string
}>(), {
  placeholder: 'Search ...',
})

const route = useRoute()
const router = useRouter()

const search = useRouteQuery('q', '', { route, router })
</script>

<template>
  <UInput
    v-model="search"
    class="max-w-xl"
    color="neutral"
    :placeholder="placeholder"
  />
</template>
