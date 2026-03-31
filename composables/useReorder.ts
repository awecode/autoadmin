import { getErrorMessageFromError } from '#layers/autoadmin/utils/form'

type MoveAction = 'first' | 'page-up' | 'page-down' | 'last'

interface ReorderOptions {
  sortField: Ref<string | undefined>
  rows: Ref<Record<string, any>[] | undefined>
  lookupColumnName: Ref<string>
  wrapperRef: Ref<HTMLElement | null>
  currentPage: Ref<number>
  totalPages: Ref<number>
  pageSize: Ref<number>
  apiPrefix: string
  modelKey: string
  onReordered: () => Promise<void>
}

export function useReorder(options: ReorderOptions) {
  const {
    sortField, rows, lookupColumnName, wrapperRef,
    currentPage, totalPages, pageSize,
    apiPrefix, modelKey, onReordered,
  } = options

  const isDragEnabled = computed(() => !!sortField.value)
  const dragSourceIndex = ref<number | null>(null)
  const isReordering = ref(false)
  const isMoving = ref(false)
  const toast = useToast()

  // --- Drag-drop (within-page) ---

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
    const handle = (event.target as HTMLElement).closest?.('[data-drag-handle]')
    if (!handle)
      return
    const index = getRowIndexFromEvent(event)
    if (index === null || !event.dataTransfer)
      return
    dragSourceIndex.value = index
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    const tr = handle.closest('tr')
    if (tr) {
      event.dataTransfer.setDragImage(tr, 0, tr.offsetHeight / 2)
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

  // --- Cross-page move actions ---

  function getMoveActions(rowLookup: string | number) {
    if (!isDragEnabled.value || totalPages.value <= 1) {
      return []
    }

    const items: { label: string, icon: string, onSelect: () => void }[] = []

    if (currentPage.value > 1) {
      items.push({
        label: 'Move to top',
        icon: 'i-lucide-chevrons-up',
        onSelect: () => handleMove(rowLookup, 'first'),
      })
      items.push({
        label: 'Move up one page',
        icon: 'i-lucide-chevron-up',
        onSelect: () => handleMove(rowLookup, 'page-up'),
      })
    }

    if (currentPage.value < totalPages.value) {
      items.push({
        label: 'Move down one page',
        icon: 'i-lucide-chevron-down',
        onSelect: () => handleMove(rowLookup, 'page-down'),
      })
      items.push({
        label: 'Move to bottom',
        icon: 'i-lucide-chevrons-down',
        onSelect: () => handleMove(rowLookup, 'last'),
      })
    }

    return [items]
  }

  async function handleMove(lookup: string | number, action: MoveAction) {
    isMoving.value = true
    try {
      await $fetch(`${apiPrefix}/reorder-move`, {
        method: 'POST',
        body: { modelKey, lookup, action, pageSize: pageSize.value },
      })
      await onReordered()
    }
    catch (err: any) {
      toast.add({
        title: 'Error',
        description: getErrorMessageFromError(err) || 'Failed to move item',
        color: 'error',
      })
    }
    finally {
      isMoving.value = false
    }
  }

  return {
    isDragEnabled,
    isReordering,
    isMoving,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragEnd,
    onDrop,
    getMoveActions,
  }
}
