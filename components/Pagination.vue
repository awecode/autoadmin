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

const page = useRouteQuery('page', 1, { route, router, transform: Number })
</script>

<template>
  <div v-if="pagination.count! > 0" class="mt-auto flex items-center justify-between">
    <div>
      <span class="text-sm text-dimmed italic">
        {{ `${pagination?.size! * (pagination.page! - 1) + 1} to
            ${Math.min(pagination.size!
        * pagination.page!, pagination.count!)} of ${pagination.count} entries` }}
      </span>
    </div>
    <UPagination
      v-if="pagination.pages! > 1"
      v-model:page="page"
      size="xs"
      :items-per-page="pagination.size!"
      :show-edges="true"
      :total="pagination.count!"
    />
  </div>
</template>
