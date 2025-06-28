<script setup lang="ts" generic="T extends Record<string, any> = Record<string, any>">
import type { Button, TableColumn } from '#ui/types'
import type { RouteLocationRaw } from 'vue-router'
import { useRouteQuery } from '@vueuse/router'
import DeleteModal from '~/components/DeleteModal.vue'

interface DataTableProps {
  endpoint: string
  deleteEndpoint?: string
  updatePage?: RouteLocationRaw
  title?: string
  columns?: Array<TableColumn<T>>
  actions?: Array<Omit<Button, 'size'> & { onClick?: () => void }>
  filters?: boolean
  defaultActions?: Array<'edit' | 'delete'>
  lookupColumnName?: string
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
  lookupColumnName: 'id',
})

const route = useRoute()
const router = useRouter()

const sort = useRouteQuery<string | undefined, { column: string, direction: 'asc' | 'desc' } | undefined>('sort', '', {
  route,
  router,
  transform: {
    get(value) {
      if (!value) {
        return undefined
      }

      const [column, direction] = value.split(':')
      return {
        column,
        direction: direction === 'desc' ? 'desc' : 'asc',
      }
    },
    set(value) {
      if (!value?.column) {
        return undefined
      }
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

const query = computed(() => ({
  ordering: sort.value?.column ? `${sort.value?.direction === 'desc' ? '-' : ''}${sort.value?.column}` : undefined,
  page: page.value,
  page_size: pageSize.value,
  search: search.value === '' ? undefined : search.value,
  ...((props.filters ? filterQuery.value : {}) as Record<string, string>),
}))

const { data, status, error, refresh } = useFetch<Data<T>>(() => props.endpoint, {
  query,
  lazy: true,
  watch: false,
})

// Keep error for display in template instead of throwing
if (error.value) {
  console.error(error.value)
}

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
    } catch (err: any) {
      useToast().add({
        title: 'Error',
        description: err.message || 'Failed to delete',
        color: 'error',
      })
    } finally {
      deleteModal.close()
    }
  }

  deleteModal.open({
    onConfirm: doDelete,
  })
}

const columns = computed(() => {
  let tableColumns = props.columns

  // Auto-generate columns from first result if no columns provided
  if ((!tableColumns || tableColumns.length === 0) && data.value?.results && data.value.results.length > 0) {
    const firstResult = data.value.results[0]
    tableColumns = Object.keys(firstResult).map(key => ({
      id: key,
      accessorKey: key,
      header: toTitleCase(key),
    }))
  }

  return [...(tableColumns || []), { id: 'actions' }]
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <slot name="header">
      <div>Columns: {{ columns }}</div>
      <div>Type: {{ typeof columns }}</div>
      <div class="flex items-center justify-between">
        <slot name="title" :title="title">
          <h1 class="text-2xl font-semibold">
            {{ title }}
          </h1>
        </slot>
        <slot name="actions">
          <div class="flex items-center gap-2">
            <slot name="actions-prepend"></slot>
            <slot name="filters" :query="filterQuery" :schema="data?.filter_schema"></slot>
            <UButton
              v-for="action in actions"
              :key="action.label"
              v-bind="action"
              size="xs"
            />
            <slot name="actions-append"></slot>
          </div>
        </slot>
      </div>
    </slot>
    <div class="flex-grow overflow-hidden">
      <slot name="table" :rows="data?.results">
        <UAlert
          v-if="error"
          color="error"
          icon="i-heroicons-exclamation-triangle"
          variant="subtle"
          :description="error.message || 'Failed to fetch data'"
          :title="error.statusMessage || 'An error occurred'"
        />
        <UTable
          v-else
          v-model:sort="sort"
          class="h-full overflow-auto"
          sort-mode="manual"
          :columns="columns"
          :data="data?.results"
          :loading="status === 'pending'"
          :ui="{
            thead: 'sticky top-0 z-10',
          }"
        >
          <template #actions-cell="scope">
            <div class="flex items-center gap-2">
              <slot name="actions-cell-prepend" v-bind="scope ?? {}"></slot>
              <slot name="actions-cell" v-bind="scope ?? {}">
                <UButton
                  v-if="props.defaultActions?.includes('edit') && updatePage"
                  color="primary"
                  icon="i-heroicons-pencil"
                  variant="ghost"
                >
                  <NuxtLink :to="{ ...updatePage, params: { ...updatePage.params, lookupValue: scope.row.original[lookupColumnName] } }">
                    Edit
                  </NuxtLink>
                </UButton>
                <UButton
                  v-if="props.defaultActions?.includes('delete') && deleteEndpoint"
                  color="error"
                  icon="i-heroicons-trash"
                  variant="ghost"
                  @click="handleDelete(scope.row.original[lookupColumnName])"
                >
                  Delete
                </UButton>
              </slot>
              <slot name="actions-cell-append" v-bind="scope ?? {}"></slot>
            </div>
          </template>
          <template v-for="(_, name) in $slots" #[name]="scope">
            <slot :name="name" v-bind="scope ?? {}"></slot>
          </template>
        </UTable>
      </slot>
    </div>
    <slot name="footer">
      <div v-if="data?.pagination.count! > 0" class="mt-auto flex items-center justify-between">
        <div>
          <span class="text-sm text-gray-500">
            {{ `Showing ${data?.pagination?.size! * (data?.pagination.page! - 1) + 1} to
            ${Math.min(data?.pagination.size!
            * data?.pagination.page!, data?.pagination.count!)} of ${data?.pagination.count} entries` }}
          </span>
        </div>
        <UPagination
          v-if="data?.pagination.pages! > 1"
          v-model="page"
          size="xs"
          :page-count="data?.pagination.size!"
          :total="data?.pagination.count!"
        />
      </div>
    </slot>
  </div>
</template>
