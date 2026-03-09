<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor
}>()

const open = ref(false)
const hoverRows = ref(0)
const hoverCols = ref(0)

const MAX_ROWS = 8
const MAX_COLS = 8

function selectSize(rows: number, cols: number) {
  if (!props.editor)
    return
  props.editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
  open.value = false
  hoverRows.value = 0
  hoverCols.value = 0
}
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'p-2' }">
    <UButton
      icon="i-lucide-table"
      color="neutral"
      variant="ghost"
      size="sm"
      :title="hoverRows && hoverCols ? `Insert ${hoverRows} × ${hoverCols} table` : 'Insert table'"
    />

    <template #content>
      <div class="flex flex-col gap-2">
        <div class="grid gap-0.5" :style="{ gridTemplateColumns: `repeat(${MAX_COLS}, minmax(0, 1rem))` }">
          <template v-for="row in MAX_ROWS" :key="`row-${row}`">
            <button
              v-for="col in MAX_COLS"
              :key="`cell-${row}-${col}`"
              type="button"
              class="h-4 w-4 rounded border border-muted/40"
              :class="row <= hoverRows && col <= hoverCols ? 'bg-primary/70 border-primary' : 'bg-default'"
              @mouseenter="hoverRows = row; hoverCols = col"
              @click="selectSize(row, col)"
            />
          </template>
        </div>
        <span class="text-xs text-dimmed">
          {{ hoverRows && hoverCols ? `${hoverRows} × ${hoverCols}` : 'Select size' }}
        </span>
      </div>
    </template>
  </UPopover>
</template>
