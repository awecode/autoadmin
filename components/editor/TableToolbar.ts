import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

export function tableToolbarItems(editor: Editor): EditorToolbarItem[][] {
  return [[
    {
      icon: 'i-lucide-arrow-left-to-line',
      tooltip: { text: 'Add column before' },
      onClick: () => {
        editor.chain().focus().addColumnBefore().run()
      },
    },
    {
      icon: 'i-lucide-arrow-right-to-line',
      tooltip: { text: 'Add column after' },
      onClick: () => {
        editor.chain().focus().addColumnAfter().run()
      },
    },
    {
      icon: 'i-lucide-minus-square',
      tooltip: { text: 'Delete column' },
      onClick: () => {
        editor.chain().focus().deleteColumn().run()
      },
    },
  ], [
    {
      icon: 'i-lucide-arrow-up-to-line',
      tooltip: { text: 'Add row above' },
      onClick: () => {
        editor.chain().focus().addRowBefore().run()
      },
    },
    {
      icon: 'i-lucide-arrow-down-to-line',
      tooltip: { text: 'Add row below' },
      onClick: () => {
        editor.chain().focus().addRowAfter().run()
      },
    },
    {
      icon: 'i-lucide-minus-circle',
      tooltip: { text: 'Delete row' },
      onClick: () => {
        editor.chain().focus().deleteRow().run()
      },
    },
  ], [
    {
      icon: 'i-lucide-layout-panel-top',
      tooltip: { text: 'Toggle header row' },
      onClick: () => {
        editor.chain().focus().toggleHeaderRow().run()
      },
    },
    {
      icon: 'i-lucide-layout-panel-left',
      tooltip: { text: 'Toggle header column' },
      onClick: () => {
        editor.chain().focus().toggleHeaderColumn().run()
      },
    },
  ], [
    {
      icon: 'i-lucide-trash-2',
      tooltip: { text: 'Delete table' },
      onClick: () => {
        editor.chain().focus().deleteTable().run()
      },
    },
  ]]
}
