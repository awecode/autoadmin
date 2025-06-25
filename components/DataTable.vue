<script setup lang="ts" generic="T extends Record<string, any> = Record<string, any>">
import type { Button, TableColumn } from '#ui/types'
import { useRouteQuery } from '@vueuse/router'
import DeleteModal from '~/components/DeleteModal.vue'

interface DataTableProps {
  endpoint: string
  deleteEndpoint?: string
  title?: string
  columns?: Array<TableColumn>
  actions?: Array<Omit<Button, 'size'> & { onClick?: () => void }>
  filters?: boolean
  defaultActions?: Array<'edit' | 'delete'>
}

interface Data<TData> {
  results: TData[]
  pagination: {
    count: number
    size: number
    page: number
    pages: number
  }
  filter_schema?: Record<string, any>
}

const props = withDefaults(defineProps<DataTableProps>(), {
  title: '',
  columns: () => ([]),
  actions: () => ([]),
  filters: true,
  deleteEndpoint: undefined,
  defaultActions: () => ['edit', 'delete'],
})

const route = useRoute()
const router = useRouter()

const columns = computed(() => [...props.columns, { id: 'actions' }])

const sort = useRouteQuery<string | undefined, { column: string, direction: 'asc' | 'desc' } | undefined>('sort', '', {
  route,
  router,
  transform: {
    get(value) {
      if (!value)
        return undefined

      const [column, direction] = value.split(':')
      return {
        column,
        direction: direction === 'desc' ? 'desc' : 'asc',
      }
    },
    set(value) {
      if (!value?.column)
        return undefined
      return `${value.column}:${value.direction}`
    },
  },
})

const search = useRouteQuery('q', '', { route, router })
const page = useRouteQuery('page', 1, { route, router, transform: Number })
const pageSize = useRouteQuery('size', 10, { route, router, transform: Number })

const filterQuery = useRouteQuery('filters', '', {
  route,
  router,
  transform: {
    get(value: string) {
      if (!value)
        return {}

      return Object.fromEntries(value.split(';').map(item => item.split(':'))) as Record<string, string>
    },
    set(value: Record<string, string>) {
      return Object.entries(value).map(([key, val]) => `${key}:${val}`).join(';')
    },
  },
})

const query = computed(() => ({
  ordering: sort.value?.column ? `${sort.value?.direction === 'desc' ? '-' : ''}${sort.value?.column}` : undefined,
  page: page.value,
  page_size: pageSize.value,
  search: search.value === '' ? undefined : search.value,
  ...((props.filters ? filterQuery.value : {}) as Record<string, string>),
}))

const { data, status, refresh } = useFetch<Data<T>>(() => props.endpoint, {
  query,
  lazy: true,
  watch: false,
})

defineExpose({ data, status, refresh, sort, page, pageSize, filterQuery, search, reset })

async function reset() {
  // Reset the filters and pagination
  filterQuery.value = {}
  page.value = 1
  pageSize.value = 10
  search.value = ''
  sort.value = undefined

  // Refresh the data
  await refresh()
}
// TODO: Emit this maybe
async function deleteObj(id: string) {
  if (!props.deleteEndpoint) {
    throw new Error('Delete endpoint not provided')
  }
  await $fetch(`${props.deleteEndpoint}/${id}`, {
    method: 'DELETE',
  })
}

const deleteModal = useOverlay().create(DeleteModal)

async function handleDelete(id: string) {
  const doDelete = async () => {
    try {
      await deleteObj(id)
      // Refresh the data to get updated list
      await refresh()
      useToast().add({
        title: 'Success',
        description: 'Deleted successfully',
        color: 'success',
      })
    }
    catch (err: any) {
      useToast().add({
        title: 'Error',
        description: err.message || 'Failed to delete',
        color: 'error',
      })
    }
    finally {
      deleteModal.close()
    }
  }

  deleteModal.open({
    onConfirm: doDelete,
  })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <slot name="header">
      <div class="flex items-center justify-between">
        <slot name="title" :title="title">
          <h1 class="text-2xl font-semibold">
            {{ title }}
          </h1>
        </slot>
        <slot name="actions">
          <div class="flex items-center gap-2">
            <slot name="actions-prepend" />
            <slot name="filters" :query="filterQuery" :schema="data?.filter_schema" />
            <UButton v-for="action in actions" :key="action.label" v-bind="action" size="xs" />
            <slot name="actions-append" />
          </div>
        </slot>
      </div>
    </slot>
    <div class="flex-grow overflow-hidden">
      <slot name="table" :rows="data?.results">
        <UTable v-model:sort="sort" class="h-full overflow-auto" sort-mode="manual" :columns="columns"
          :data="data?.results" :loading="status === 'pending'" :ui="{
            thead: 'sticky top-0 z-10',
          }">
          <template #actions-cell="scope">
            <div class="flex items-center gap-2">
              <slot name="actions-cell-prepend" v-bind="scope ?? {}" />
              <slot name="actions-cell" v-bind="scope ?? {}">
                <UButton v-if="props.defaultActions?.includes('delete')" color="error" icon="i-heroicons-trash"
                  variant="ghost" @click="handleDelete(scope.row.original.id)">
                  Delete
                </UButton>
              </slot>
              <slot name="actions-cell-append" v-bind="scope ?? {}" />
            </div>
          </template>
          <template v-for="(_, name) in $slots" #[name]="scope">
            <slot :name="name" v-bind="scope ?? {}" />
          </template>
        </UTable>
      </slot>
    </div>
    <slot name="footer">
      <div v-if="data?.pagination.count! > 0" class="mt-auto flex items-center justify-between">
        <div>
          <span class="text-sm text-gray-500">
            {{ `Showing ${data?.pagination?.size! * (data?.pagination.page! - 1) + 1} to
            ${Math.min(data?.pagination.size! *
              data?.pagination.page!, data?.pagination.count!)} of ${data?.pagination.count} entries` }}
          </span>
        </div>
        <UPagination v-if="data?.pagination.pages! > 1" v-model="page" size="xs" :page-count="data?.pagination.size!"
          :total="data?.pagination.count!" />
      </div>
    </slot>
  </div>
</template>
