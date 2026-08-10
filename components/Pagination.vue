<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'

defineProps<{
  pagination: {
    count: number
    size: number
    page: number
    pages: number
  }
}>()

const route = useRoute()
const router = useRouter()

const page = useRouteQuery('page', 1, { route, router, transform: Number, mode: 'push' })
</script>

<template>
  <div
    v-if="pagination?.count! > 0"
    class="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
  >
    <p class="shrink-0 text-sm text-dimmed italic whitespace-nowrap">
      {{
        `${pagination.size! * (pagination.page! - 1) + 1} to ${Math.min(
          pagination.size! * pagination.page!,
          pagination.count!,
        )} of ${pagination.count} entries`
      }}
    </p>
    <div v-if="pagination.pages! > 1" class="max-w-full min-w-0 overflow-x-auto">
      <UPagination
        v-model:page="page"
        size="xs"
        :items-per-page="pagination.size!"
        :show-edges="true"
        :total="pagination.count!"
      />
    </div>
  </div>
</template>
