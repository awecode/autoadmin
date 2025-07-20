<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import type { Column, HeaderContext, Row, Table } from '@tanstack/vue-table'
import { humanifyDateTime } from '#layers/autoadmin/utils/date'
import { useRouteQuery } from '@vueuse/router'
import { h, resolveComponent } from 'vue'
import DeleteModal from '~/components/DeleteModal.vue'
import { getTitle } from '~/utils/autoadmin'
import { getErrorMessage } from '~/utils/form'
import { getFileNameFromUrl } from '~/utils/string'

const UButton = resolveComponent('UButton')
const UCheckbox = resolveComponent('UCheckbox')

type T = Record<string, any>

interface ListApiResponse {
  results: T[]
  pagination: {
    count: number
    size: number
    page: number
    pages: number
  }
  filters?: Record<string, any>
  spec: {
    endpoint: string
    updatePage?: { name: string, params: { modelLabel: string } }
    deleteEndpoint?: string
    title: string
    // API return header as string, and an optional sortKey
    columns?: Array<TableColumn<T> & { header: string, sortKey?: string }>
    lookupColumnName: string
    enableSearch: boolean
    enableSort: boolean
    searchPlaceholder: string
    searchFields: string[]
    showCreateButton: boolean
  }
}

const filters = true
const table = useTemplateRef<{ tableApi: Table<T> } | undefined>('table')
const defaultActions = ['edit', 'delete']

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')

const route = useRoute()
const router = useRouter()

const sort = useRouteQuery<string | undefined, { id: string, desc: boolean }[] | undefined>('sort', '', {
  route,
  router,
  transform: {
    get(value: string | undefined) {
      if (!value) {
        return undefined
      }

      const [column, direction] = value.split(':')
      return [{
        id: column,
        desc: direction === 'desc',
      }]
    },
    set(value) {
      if (!value?.length) {
        return undefined
      }
      return `${value[0].id}:${value[0].desc ? 'desc' : 'asc'}`
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
  ordering: route.query.sort,
  page: page.value,
  page_size: pageSize.value,
  search: search.value === '' ? undefined : search.value,
  ...((filters ? filterQuery.value : {}) as Record<string, string>),
}))

const endpoint = `${apiPrefix}/${modelLabel}`

const { data, status, error, refresh } = useAsyncData<ListApiResponse>(`${modelLabel}-list`, async () => {
  const response = await $fetch<ListApiResponse>(endpoint, { query: query.value })
  return {
    ...response,
    spec: response?.spec || {},
  }
}, {
  watch: [query],
})

const spec = computed(() => data.value?.spec || {} as ListApiResponse['spec'])

const title = computed(() => spec.value.title || toTitleCase(modelLabel))

const pageActions = computed(() => {
  const actions: { label: string, to?: { name: string, params: { modelLabel: string } } }[] = []

  if (spec.value.showCreateButton) {
    actions.push({
      label: 'Add',
      to: { name: 'autoadmin-create', params: { modelLabel: `${modelLabel}` } },
    })
  }
  return actions
})

function getHeader(column: Column<T>, label?: string, sortKey?: string) {
  const isSorted = column.getIsSorted()

  if (spec.value.enableSort && sortKey) {
    return h(UButton, {
      'color': 'neutral',
      'variant': 'ghost',
      label,
      'icon': isSorted
        ? isSorted === 'asc'
          ? 'i-lucide-arrow-up-narrow-wide'
          : 'i-lucide-arrow-down-wide-narrow'
        : 'i-lucide-arrow-up-down',
      'class': '-mx-2.5',
      'aria-label': `Sort by ${label}`,
      'onClick': () => {
      // Cycle through: no sort → asc → desc → no sort
        if (!isSorted) {
          column.toggleSorting(false) // asc
        } else if (isSorted === 'asc') {
          column.toggleSorting(true) // desc
        } else {
          column.clearSorting() // no sort
        }
      },
    })
  } else {
    return label
  }
}

function computeColumns() {
  const tableColumns = spec.value.columns
  if (!tableColumns) {
    return []
  }
  const parsedColumns = tableColumns.map(col => ({
    ...col,
    header: ({ column }: { column: Column<T> }) => getHeader(column, col.header as string, col.sortKey),
  })) as unknown as (TableColumn<T> & { header?: (props: HeaderContext<T, unknown>) => any })[]

  if (spec.value.updatePage || spec.value.deleteEndpoint) {
    parsedColumns!.push({
      id: 'actions',
    })
  }

  parsedColumns!.unshift({
    id: 'select',
    header: ({ table }) => h(UCheckbox, {
      'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
      'aria-label': 'Select all',
    }),
    cell: ({ row }: { row: Row<T> }) => h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
      'aria-label': 'Select row',
    }),
    enableSorting: false,
    enableHiding: false,
  })

  return parsedColumns
}

const computedColumns = computed(() => computeColumns())

// Keep error for display in template instead of throwing
if (error.value) {
  console.error(error.value)
}

useHead({
  title: `${title.value} | ${getTitle()}`,
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
        description: getErrorMessage(err) || 'Failed to delete',
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

const selectedRows = computed(() => table.value?.tableApi?.getFilteredSelectedRowModel().rows ?? [])

const toast = useToast()

const bulkDelete = async ({ rowLookups }: { rowLookups: string[] }) => {
  try {
    await $fetch(`${apiPrefix}/bulk-delete`, {
      method: 'POST',
      body: {
        modelLabel,
        rowLookups,
      },
    })
    toast.add({
      title: 'Success',
      description: 'Deleted successfully',
      color: 'success',
    })
    refresh()
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: getErrorMessage(err) || 'Failed to delete',
      color: 'error',
    })
  }
}

const bulkActions: { label: string, value: string, icon: string, action: (props: { rowLookups: string[], rows: Row<T>[] }) => Promise<void> }[] = [
  {
    label: 'Delete',
    value: 'delete',
    icon: 'i-lucide-trash',
    action: bulkDelete,
  },
]
const bulkAction = ref<string | undefined>(undefined)

const performBulkAction = async () => {
  const actionValue = bulkAction.value
  if (actionValue) {
    const rows = selectedRows.value
    const rowLookups = rows.map(row => row.original[spec.value.lookupColumnName])
    await bulkActions.find(action => action.value === actionValue)?.action?.({ rowLookups, rows })
    bulkAction.value = undefined
  }
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
            <Filters v-if="data?.filters" :filters="data.filters" />
            <UButton
              v-for="action in pageActions"
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
      <div class="flex justify-between py-3">
        <UInput
          v-if="spec.enableSearch"
          v-model="search"
          class="max-w-xl"
          :placeholder="spec.searchPlaceholder"
        />
        <!-- Multi-row Actions -->
        <div v-if="selectedRows.length > 0" class="flex items-center gap-2 ml-auto">
          <span class="text-sm text-muted">
            {{ selectedRows.length }} {{ selectedRows.length === 1 ? 'row' : 'rows' }} selected
          </span>
          <USelect
            v-model="bulkAction"
            class="min-w-24"
            placeholder="Select an action"
            :items="bulkActions"
          />
          <UButton
            v-if="bulkAction"
            color="neutral"
            @click="performBulkAction"
          >
            Confirm
          </UButton>
        </div>
      </div>
      <slot name="table" :rows="data?.results">
        <UAlert
          v-if="error"
          color="error"
          icon="i-lucide-triangle-alert"
          variant="subtle"
          :description="error.message || 'Failed to fetch data'"
          :title="error.statusMessage || 'An error occurred'"
        />
        <div v-else-if="status === 'pending'">
          <UProgress animation="elastic" />
        </div>
        <UTable
          v-else-if="data && status === 'success'"
          ref="table"
          v-model:sorting="sort"
          class="h-full overflow-auto"
          :columns="computedColumns"
          :data="data?.results"
          :sorting-options="{
            manualSorting: true,
          }"
          :ui="{
            thead: 'sticky top-0 z-10',
          }"
          @update:sorting="sort = $event"
        >
          <!-- Dynamic cell templates for all columns except actions -->
          <template
            v-for="column in computedColumns.filter((col: TableColumn<T>) => !['actions', 'select'].includes(col.id ?? ''))"
            :key="column.id"
            #[`${column.id}-cell`]="{ cell }"
          >
            <template v-if="'type' in cell.column.columnDef">
              <template v-if="cell.column.columnDef.type === 'boolean'">
                <span v-if="cell.getValue()">Yes</span>
                <span v-else>No</span>
              </template>
              <template v-else-if="cell.column.columnDef.type === 'file' && cell.getValue()">
                <!-- Open file in new tab -->
                <NuxtLink class="flex items-center underline" target="_blank" :to="cell.getValue() as string">
                  <UIcon class="inline-block mr-1" name="i-lucide-file" />
                  <!-- Show file name -->
                  <span class="text-sm">{{ getFileNameFromUrl(cell.getValue() as string) }}</span>
                </NuxtLink>
              </template>
              <template v-else-if="cell.column.columnDef.type === 'image' && cell.getValue()">
                <NuxtLink target="_blank" :to="cell.getValue() as string">
                  <img class="w-10 h-10 rounded-md" :src="cell.getValue() as string" />
                </NuxtLink>
              </template>

              <template v-else-if="cell.column.columnDef.type === 'date'">
                {{ humanifyDateTime(cell.getValue() as string | Date, { includeTime: false }) }}
              </template>
              <template v-else-if="cell.column.columnDef.type === 'datetime-local'">
                {{ humanifyDateTime(cell.getValue() as string | Date) }}
              </template>
              <template v-else>
                {{ cell.getValue() }}
              </template>
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
                  <UButton color="primary" icon="i-lucide-square-pen" variant="ghost">
                    Edit
                  </UButton>
                </NuxtLink>
                <UButton
                  v-if="defaultActions?.includes('delete') && spec.deleteEndpoint"
                  color="error"
                  icon="i-lucide-trash"
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
