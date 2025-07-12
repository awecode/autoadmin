<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import { humanifyDateTime } from '#layers/autoadmin/utils/date'
import { useRouteQuery } from '@vueuse/router'
import DeleteModal from '~/components/DeleteModal.vue'

type T = Record<string, any>

interface Data<TData> {
  results: TData[]
  pagination: {
    count: number
    size: number
    page: number
    pages: number
  }
  filter_schema?: Record<string, any>
  spec: {
    endpoint: string
    updatePage?: { name: string, params: { modelLabel: string } }
    deleteEndpoint?: string
    title: string
    columns?: Array<TableColumn<T>>
    lookupColumnName: string
    enableSearch: boolean
    searchPlaceholder: string
    searchFields: string[]
  }
}

const filters = true
const defaultActions = ['edit', 'delete']

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')

const actions = [
  {
    label: 'Add',
    to: { name: 'autoadmin-create', params: { modelLabel: `${modelLabel}` } },
  },
]

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
  ...((filters ? filterQuery.value : {}) as Record<string, string>),
}))

const endpoint = `${apiPrefix}/${modelLabel}`

const { data, status, error, refresh } = useAsyncData<Data<T> & { spec?: Record<string, any> }>(`${modelLabel}-list`, async () => {
  const response = await $fetch<Data<T>>(endpoint, { query: query.value })
  return {
    ...response,
    spec: response?.spec || {},
  }
}, {
  watch: [query],
})

const spec = computed(() => data.value?.spec || {} as Record<string, any>)

const title = computed(() => spec.value.title || toTitleCase(modelLabel))

function computeColumns(results: T[]) {
  let tableColumns = spec.value.columns

  // Auto-generate columns from first result if no columns provided
  if ((!tableColumns || tableColumns.length === 0) && results && results.length > 0) {
    const firstResult = results[0]
    tableColumns = Object.keys(firstResult).map(key => ({
      id: key,
      accessorKey: key,
      header: toTitleCase(key),
    }))
  }
  return [...(tableColumns || []), { id: 'actions' }]
}

const computedColumns = computed(() => computeColumns(data.value?.results ?? []))

// Keep error for display in template instead of throwing
if (error.value) {
  console.error(error.value)
}

useHead({
  title: `${title.value}`,
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
  if (!spec.value.deleteEndpoint) {
    throw new Error('Delete endpoint not provided')
  }
  await $fetch(`${spec.value.deleteEndpoint}/${id}`, {
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
</script>

<template>
  <div class="flex flex-col gap-6">
    <slot name="header">
      <div class="flex items-center justify-between">
        <slot name="title">
          <h1 class="text-2xl font-semibold">
            {{ title }}
          </h1>
        </slot>
        <slot name="actions">
          <div class="flex items-center gap-2">
            <slot name="actions-prepend"></slot>
            <!-- <slot name="filters" :query="filterQuery" :schema="data?.filter_schema"></slot> -->
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
      <div v-if="spec.enableSearch" class="flex py-3 border-b">
        <UInput
          v-model="search"
          class="max-w-xl"
          :placeholder="spec.searchPlaceholder"
        />
      </div>
      <slot name="table" :rows="data?.results">
        <UAlert
          v-if="error"
          color="error"
          icon="i-heroicons-exclamation-triangle"
          variant="subtle"
          :description="error.message || 'Failed to fetch data'"
          :title="error.statusMessage || 'An error occurred'"
        />
        <div v-else-if="status === 'pending'">
          <UProgress animation="elastic" />
        </div>
        <UTable
          v-else-if="data && status === 'success'"
          v-model:sort="sort"
          class="h-full overflow-auto"
          sort-mode="manual"
          :columns="computedColumns"
          :data="data?.results"
          :ui="{
            thead: 'sticky top-0 z-10',
          }"
        >
          <!-- Dynamic cell templates for all columns except actions -->
          <template
            v-for="column in computedColumns.filter(col => col.id !== 'actions')"
            :key="column.id"
            #[`${column.id}-cell`]="{ cell }"
          >
            <template v-if="cell.column.columnDef.type === 'boolean'">
              <span v-if="cell.getValue()">Yes</span>
              <span v-else>No</span>
            </template>
            <template v-else-if="cell.column.columnDef.type === 'date'">
              {{ humanifyDateTime(cell.getValue()) }}
            </template>
            <template v-else-if="cell.column.columnDef.type === 'datetime-local'">
              {{ humanifyDateTime(cell.getValue()) }}
            </template>
            <template v-else>
              {{ cell.getValue() }}
            </template>
          </template>

          <template #actions-cell="scope">
            <div class="flex items-center gap-2">
              <slot name="actions-cell-prepend" v-bind="scope ?? {}"></slot>
              <slot name="actions-cell" v-bind="scope ?? {}">
                <NuxtLink
                  v-if="defaultActions?.includes('edit') && spec.updatePage"
                  :to="{ ...spec.updatePage, params: { ...spec.updatePage.params, lookupValue: scope.row.original[data.spec.lookupColumnName] } }"
                >
                  <UButton color="primary" icon="i-heroicons-pencil" variant="ghost">
                    Edit
                  </UButton>
                </NuxtLink>
                <UButton
                  v-if="defaultActions?.includes('delete') && spec.deleteEndpoint"
                  color="error"
                  icon="i-heroicons-trash"
                  variant="ghost"
                  @click="handleDelete(scope.row.original[spec.lookupColumnName])"
                >
                  Delete
                </UButton>
              </slot>
              <slot name="actions-cell-append" v-bind="scope ?? {}"></slot>
            </div>
          </template>
          <!-- <template v-for="(_, name) in $slots" #[name]="scope">
            <slot :name="name" v-bind="scope ?? {}"></slot>
          </template> -->
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
          v-model:page="page"
          size="xs"
          :page-count="data?.pagination.size!"
          :total="data?.pagination.count!"
        />
      </div>
    </slot>
  </div>
</template>
