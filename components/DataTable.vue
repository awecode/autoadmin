<script setup lang="ts">
import type { FilterSpec } from '#layers/autoadmin/server/utils/filter'
import type { TableColumn } from '#ui/types'
import type { Column, HeaderContext, Row, Table } from '@tanstack/vue-table'
// import type { PropType, VNode } from 'vue'
import DeleteModal from '#layers/autoadmin/components/DeleteModal.vue'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'
import { humanifyDateTime } from '#layers/autoadmin/utils/date'
import { getErrorMessageFromError } from '#layers/autoadmin/utils/form'
import { getFileNameFromUrl } from '#layers/autoadmin/utils/string'
import { useRouteQuery } from '@vueuse/router'
import { h, resolveComponent } from 'vue'

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
  aggregates?: {
    [key: string]: {
      label: string
      value: number
    }
  }
  filters?: FilterSpec[]
  spec: {
    endpoint: string
    updatePage?: { name: string, params: { modelKey: string } }
    deleteEndpoint?: string
    title: string
    // API return header as string, and an optional sortKey
    columns?: Array<TableColumn<T> & { header: string, sortKey?: string }>
    lookupColumnName: string
    enableDelete: boolean
    enableSearch: boolean
    bulkActions: { label: string, icon?: string }[]
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
const modelKey = (useRoute().params.modelKey as string).replace(/\/$/, '')

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
      if (column) {
        return [{
          id: column,
          desc: direction === 'desc',
        }]
      }
      return undefined
    },
    set(value) {
      if (!value?.length) {
        return undefined
      }
      return `${value[0]!.id}:${value[0]!.desc ? 'desc' : 'asc'}`
    },
  },
})

const search = useRouteQuery('q', '', { route, router })
const page = useRouteQuery('page', 1, { route, router, transform: Number })

const paginationConfig = config.public?.pagination
const defaultSize = (paginationConfig && typeof paginationConfig === 'object' && 'defaultSize' in paginationConfig && typeof paginationConfig.defaultSize === 'number' ? paginationConfig.defaultSize : 20)
const size = useRouteQuery('size', defaultSize, { route, router, transform: Number })

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
  page: route.query.page ?? 1,
  size: size.value,
  search: route.query.q === '' ? undefined : route.query.q,
  ...((filters ? filterQuery.value : {}) as Record<string, string>),
}))

const endpoint = `${apiPrefix}/${modelKey}`

const { data, status, error, refresh } = useAsyncData<ListApiResponse>(`${modelKey}-list`, async () => {
  const response = await $fetch<ListApiResponse>(endpoint, { query: query.value })
  return {
    ...response,
    spec: response?.spec || {},
  }
}, {
  watch: [query],
})

const spec = computed(() => data.value?.spec || {} as ListApiResponse['spec'])

const title = computed(() => spec.value.title || toTitleCase(modelKey))

const pageActions = computed(() => {
  const actions: { label: string, icon?: string, color?: string, variant?: string, to?: { name: string, params: { modelKey: string } } }[] = []

  if (spec.value.showCreateButton) {
    actions.push({
      label: 'Add New',
      icon: 'i-lucide-plus',
      color: 'neutral',
      variant: 'solid',
      to: { name: 'autoadmin-create', params: { modelKey } },
    })
  }
  return actions
})

const toast = useToast()

const bulkDelete = async ({ rowLookups }: { rowLookups: string[] }) => {
  try {
    await $fetch(`${apiPrefix}/bulk-delete`, {
      method: 'POST',
      body: {
        modelKey,
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
      description: getErrorMessageFromError(err) || 'Failed to delete',
      color: 'error',
    })
  }
}

const genericBulkAction = async ({ action, rowLookups }: { action: string, rowLookups: string[] }) => {
  try {
    const response = await $fetch<{ message: string, refresh?: boolean }>(`${apiPrefix}/bulk-actions`, {
      method: 'POST',
      body: {
        modelKey,
        rowLookups,
        action,
      },
    })
    toast.add({
      title: 'Success',
      description: response.message || 'Action performed successfully',
      color: 'success',
    })
    if (response.refresh) {
      refresh()
    }
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: getErrorMessageFromError(err) || 'Failed to perform action',
      color: 'error',
    })
  }
}

const bulkActions = computed(() => {
  const actions: { label: string, icon?: string, action: (props: { action: string, rowLookups: string[], rows: Row<T>[] }) => Promise<void> }[] = []

  if (spec.value.enableDelete) {
    actions.push({
      label: 'Delete',
      icon: 'i-lucide-trash',
      action: bulkDelete,
    })
  }
  if (spec.value.bulkActions.length) {
    const userDefinedActions = spec.value.bulkActions.map(action => ({
      label: action.label,
      icon: action.icon,
      action: genericBulkAction,
    }))
    actions.push(...userDefinedActions)
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
  if (bulkActions.value.length) {
    parsedColumns!.unshift({
      id: 'select',
      header: ({ table }) => h(UCheckbox, {
        'color': 'neutral',
        'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Select all',
      }),
      cell: ({ row }: { row: Row<T> }) => h(UCheckbox, {
        'color': 'neutral',
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': 'Select row',
      }),
      enableSorting: false,
      enableHiding: false,
    })
  }

  return parsedColumns
}

const computedColumns = computed(() => computeColumns())

// Keep error for display in template instead of throwing
if (error.value) {
  console.error(error.value)
}

const baseTitle = getAdminTitle()

useHead({
  title: computed(() => `${title.value} | ${baseTitle}`),
})

defineExpose({ data, status, refresh, sort, page, size, filterQuery, search, reset })

async function reset() {
  // Reset the filters and pagination
  filterQuery.value = {}
  page.value = 1
  // size.value = 10
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
        description: getErrorMessageFromError(err) || 'Failed to delete',
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

const bulkAction = ref<string | undefined>(undefined)

const performBulkAction = async () => {
  const actionValue = bulkAction.value
  if (actionValue) {
    const rows = selectedRows.value
    const rowLookups = rows.map(row => row.original[spec.value.lookupColumnName])
    await bulkActions.value.find(action => action.label === actionValue)?.action?.({ action: actionValue, rowLookups, rows })
    bulkAction.value = undefined
  }
}

// const modelCfg = useAdminRegistry().get(modelKey)
// // find fields with cell in modelCfg?.list.fields and get the accessorKey and prepare a dict with accessorKey as key and cell as value
// const cellFunctions = modelCfg?.list.fields?.filter(field => typeof field === 'object' && 'cell' in field).reduce((acc, def) => {
//   if (typeof def === 'object' && 'cell' in def) {
//     let accessorKey: string | undefined
//     if (typeof def.field === 'string') {
//       if (def.field.includes('.')) {
//         accessorKey = def.field.replace('.', '__')
//       }
//       accessorKey = def.field
//     } else if (typeof def.field === 'function') {
//       accessorKey = def.field.name
//     }
//     if (accessorKey && def.cell) {
//       acc[accessorKey] = def.cell
//     }
//   }
//   return acc
// }, {} as Record<string, (row: { row: Record<string, any> }) => string | VNode>)

// // Helper component to render cell functions
// const CellRenderer = defineComponent({
//   props: {
//     cellFunction: {
//       type: Function as PropType<(cell: any) => any>,
//       required: true,
//     },
//     cell: {
//       type: Object,
//       required: true,
//     },
//   },
//   setup(props) {
//     const result = computed(() => props.cellFunction(props.cell))

//     return () => {
//       const value = result.value

//       if (typeof value === 'string') {
//         return h('div', { innerHTML: value })
//       } else if (typeof value === 'object' && value?.__v_isVNode) {
//         return value
//       } else {
//         return String(value)
//       }
//     }
//   },
// })
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
            <UButton v-for="action in pageActions" :key="action.label" v-bind="action" />
            <slot name="actions-append"></slot>
          </div>
        </slot>
      </div>
    </slot>

    <slot name="filters">
      <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div class="place-self-end">
          <!-- <div class="text-sm text-dimmed mb-1">
            Search {{ title }}
          </div> -->
          <UInput
            v-if="spec.enableSearch"
            v-model="search"
            class="max-w-xl"
            color="neutral"
            :placeholder="spec.searchPlaceholder"
          />
        </div>
        <Filters v-if="data?.filters" :filters="data.filters" />
        <!-- Multi-row Actions -->
        <div v-if="selectedRows.length > 0">
          <div class="text-sm mb-1">
            {{ selectedRows.length }} {{ selectedRows.length === 1 ? 'row' : 'rows' }} selected
          </div>
          <div class="flex items-center gap-2">
            <USelect
              v-model="bulkAction"
              highlight
              class="min-w-24"
              color="neutral"
              placeholder="Select an action"
              value-key="label"
              variant="soft"
              :items="bulkActions"
              :ui="{ content: 'min-w-fit' }"
            />
            <UButton v-if="bulkAction" color="neutral" @click="performBulkAction">
              Confirm
            </UButton>
          </div>
        </div>
      </div>
    </slot>

    <slot name="table" :rows="data?.results">
      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-triangle-alert"
        variant="subtle"
        :title="error.statusMessage || error.message || 'An error occurred while fetching data'"
      />
      <div v-else-if="status === 'pending'">
        <UProgress animation="swing" color="neutral" />
      </div>
      <UTable
        v-else-if="data && status === 'success'"
        ref="table"
        v-model:sorting="sort"
        :columns="computedColumns"
        :data="data?.results"
        :sorting-options="{
          manualSorting: true,
        }"
        @update:sorting="sort = $event"
      >
        <!-- Dynamic cell templates for all columns except actions -->
        <template
          v-for="column in computedColumns.filter((col: TableColumn<T>) => !['actions', 'select'].includes(col.id ?? ''))"
          :key="column.id"
          #[`${column.id}-cell`]="{ cell: c }"
        >
          <!-- <template v-if="cellFunctions && 'accessorKey' in c.column.columnDef && cellFunctions[c.column.columnDef.accessorKey]">
            <CellRenderer
              :cell="c"
              :cell-function="cellFunctions[c.column.columnDef.accessorKey]!"
            />
          </template> -->
          <template v-if="'type' in c.column.columnDef">
            <template v-if="c.column.columnDef.type === 'boolean'">
              <span v-if="c.getValue()">Yes</span>
              <span v-else>No</span>
            </template>
            <template v-else-if="c.column.columnDef.type === 'file' && c.getValue()">
              <!-- Open file in new tab -->
              <NuxtLink class="flex items-center underline" target="_blank" :to="c.getValue() as string">
                <UIcon class="inline-block mr-1" name="i-lucide-file" />
                <!-- Show file name -->
                <span class="text-sm">{{ getFileNameFromUrl(c.getValue() as string) }}</span>
              </NuxtLink>
            </template>
            <template v-else-if="c.column.columnDef.type === 'image' && c.getValue()">
              <NuxtLink target="_blank" :to="c.getValue() as string">
                <img class="w-10 h-10 rounded-md" :src="c.getValue() as string" />
              </NuxtLink>
            </template>

            <template v-else-if="c.column.columnDef.type === 'date'">
              {{ humanifyDateTime(c.getValue() as string | Date, { includeTime: false }) }}
            </template>
            <template v-else-if="c.column.columnDef.type === 'datetime-local'">
              {{ humanifyDateTime(c.getValue() as string | Date) }}
            </template>
            <template v-else>
              {{ c.getValue() }}
            </template>
          </template>
          <template v-else>
            {{ c.getValue() }}
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
                <UButton
                  aria-label="Edit"
                  color="neutral"
                  icon="i-lucide-square-pen"
                  variant="ghost"
                >
                  <!-- Edit -->
                </UButton>
              </NuxtLink>
              <UButton
                v-if="defaultActions?.includes('delete') && spec.deleteEndpoint && spec.enableDelete"
                aria-label="Delete"
                color="error"
                icon="i-lucide-trash"
                variant="ghost"
                @click="handleDelete(scope.row.original[spec.lookupColumnName])"
              >
                <!-- Delete -->
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

    <!-- Aggregates Section -->
    <slot name="aggregates">
      <div v-if="data?.aggregates && Object.keys(data.aggregates).length > 0" class="mt-6 sm:mt-8">
        <div class="flex flex-wrap gap-3 sm:gap-4">
          <div
            v-for="(aggregate, key) in data.aggregates"
            :key="key"
            class="flex-1 min-w-40 sm:min-w-48 max-w-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div class="flex flex-col">
              <dt class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                {{ aggregate.label }}
              </dt>
              <dd class="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {{ typeof aggregate.value === 'number' ? aggregate.value.toLocaleString() : aggregate.value }}
              </dd>
            </div>
          </div>
        </div>
      </div>
    </slot>

    <slot name="footer">
      <div v-if="data?.pagination.count! > 0" class="mt-auto flex items-center justify-between">
        <div>
          <span class="text-sm text-dimmed italic">
            {{ `${data?.pagination?.size! * (data?.pagination.page! - 1) + 1} to
            ${Math.min(data?.pagination.size!
            * data?.pagination.page!, data?.pagination.count!)} of ${data?.pagination.count} entries` }}
          </span>
        </div>
        <UPagination
          v-if="data?.pagination.pages! > 1"
          v-model:page="page"
          size="xs"
          :items-per-page="data?.pagination.size!"
          :show-edges="true"
          :total="data?.pagination.count!"
        />
      </div>
    </slot>
  </div>
</template>
