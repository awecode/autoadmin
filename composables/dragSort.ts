import { getErrorMessageFromError } from '#layers/autoadmin/utils/form'

interface DragSortOptions {
  sortField: Ref<string | undefined>
  rows: Ref<Record<string, any>[] | undefined>
  lookupColumnName: Ref<string>
  wrapperRef: Ref<HTMLElement | null>
  apiPrefix: string
  modelKey: string
  onReordered: () => Promise<void>
}

export function useDragSort(options: DragSortOptions) {
  const { sortField, rows, lookupColumnName, wrapperRef, apiPrefix, modelKey, onReordered } = options

  const isDragEnabled = computed(() => !!sortField.value)
  const dragSourceIndex = ref<number | null>(null)
  const isReordering = ref(false)
  const toast = useToast()

  function getRowIndexFromEvent(event: DragEvent): number | null {
    const tr = (event.target as HTMLElement).closest?.('tr')
    if (!tr?.parentElement || tr.parentElement.tagName !== 'TBODY')
      return null
    return Array.from(tr.parentElement.children).indexOf(tr)
  }

  function clearDropIndicators() {
    if (!wrapperRef.value)
      return
    wrapperRef.value.querySelectorAll('tbody tr').forEach((tr) => {
      ;(tr as HTMLElement).style.boxShadow = ''
      tr.classList.remove('opacity-50')
    })
  }

  function onDragStart(event: DragEvent) {
    const index = getRowIndexFromEvent(event)
    if (index === null || !event.dataTransfer)
      return
    dragSourceIndex.value = index
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    const tr = (event.target as HTMLElement).closest('tr')
    if (tr) {
      requestAnimationFrame(() => tr.classList.add('opacity-50'))
    }
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = 'move'
  }

  function onDragEnter(event: DragEvent) {
    event.preventDefault()
    const index = getRowIndexFromEvent(event)
    if (index === null || index === dragSourceIndex.value)
      return

    clearDropIndicators()
    if (dragSourceIndex.value !== null && wrapperRef.value) {
      const tbody = wrapperRef.value.querySelector('tbody')
      if (tbody) {
        const sourceRow = tbody.children[dragSourceIndex.value] as HTMLElement | undefined
        sourceRow?.classList.add('opacity-50')
      }
    }

    const tr = (event.target as HTMLElement).closest('tr')
    if (tr && dragSourceIndex.value !== null) {
      tr.style.boxShadow = index > dragSourceIndex.value
        ? 'inset 0 -2px 0 0 var(--ui-primary)'
        : 'inset 0 2px 0 0 var(--ui-primary)'
    }
  }

  function onDragEnd() {
    dragSourceIndex.value = null
    clearDropIndicators()
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault()
    const targetIndex = getRowIndexFromEvent(event)
    const sourceIndex = dragSourceIndex.value

    onDragEnd()

    if (targetIndex === null || sourceIndex === null || targetIndex === sourceIndex)
      return
    await handleReorder(sourceIndex, targetIndex)
  }

  async function handleReorder(fromIndex: number, toIndex: number) {
    if (!rows.value || isReordering.value)
      return

    isReordering.value = true
    const results = [...rows.value]
    const [moved] = results.splice(fromIndex, 1)
    results.splice(toIndex, 0, moved!)

    const orderedLookups = results.map(row => row[lookupColumnName.value])

    try {
      await $fetch(`${apiPrefix}/reorder`, {
        method: 'POST',
        body: { modelKey, orderedLookups },
      })
      await onReordered()
    }
    catch (err: any) {
      toast.add({
        title: 'Error',
        description: getErrorMessageFromError(err) || 'Failed to reorder',
        color: 'error',
      })
      await onReordered()
    }
    finally {
      isReordering.value = false
    }
  }

  function setupDragRows() {
    if (!isDragEnabled.value || !wrapperRef.value)
      return
    const tbody = wrapperRef.value.querySelector('tbody')
    if (!tbody)
      return
    Array.from(tbody.children).forEach((row) => {
      ;(row as HTMLElement).draggable = true
    })
  }

  watchEffect(() => {
    if (rows.value && isDragEnabled.value) {
      setupDragRows()
    }
  }, { flush: 'post' })

  return {
    isDragEnabled,
    isReordering,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragEnd,
    onDrop,
  }
}
