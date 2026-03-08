<script setup lang="ts">
import type { DropdownMenuItem, EditorCustomHandlers, EditorSuggestionMenuItem, EditorToolbarItem } from '@nuxt/ui'
import type { Editor, JSONContent } from '@tiptap/vue-3'
import { mapEditorItems } from '@nuxt/ui/utils/editor'
import FileHandler from '@tiptap/extension-file-handler'
import { TextAlign } from '@tiptap/extension-text-align'
import { upperFirst } from 'scule'
import { AdvancedImage, imageToolbarItems } from './AdvancedImage'
import EditorImagePopover from './EditorImagePopover.vue'
import EditorLinkPopover from './EditorLinkPopover.vue'
import { Figure } from './Figure'
import { handleFiles } from './FileUpload'
import { MediaText } from './MediaText'

const editorRef = useTemplateRef('editorRef')

const value = ref(``)

const customHandlers = {
  imageUpload: {
    canExecute: (editor: Editor) => editor.can().insertContent({ type: 'imageUpload' }),
    execute: (editor: Editor) => editor.chain().focus().insertContent({ type: 'imageUpload' }),
    isActive: (editor: Editor) => editor.isActive('imageUpload'),
    isDisabled: undefined,
  },
} satisfies EditorCustomHandlers

const fixedToolbarItems = [[{
  kind: 'undo',
  icon: 'i-lucide-undo',
  tooltip: { text: 'Undo' },
}, {
  kind: 'redo',
  icon: 'i-lucide-redo',
  tooltip: { text: 'Redo' },
}], [{
  icon: 'i-lucide-heading',
  tooltip: { text: 'Headings' },
  content: {
    align: 'start',
  },
  items: [{
    kind: 'heading',
    level: 1,
    icon: 'i-lucide-heading-1',
    label: 'Heading 1',
  }, {
    kind: 'heading',
    level: 2,
    icon: 'i-lucide-heading-2',
    label: 'Heading 2',
  }, {
    kind: 'heading',
    level: 3,
    icon: 'i-lucide-heading-3',
    label: 'Heading 3',
  }, {
    kind: 'heading',
    level: 4,
    icon: 'i-lucide-heading-4',
    label: 'Heading 4',
  }],
}, {
  icon: 'i-lucide-list',
  tooltip: { text: 'Lists' },
  content: {
    align: 'start',
  },
  items: [{
    kind: 'bulletList',
    icon: 'i-lucide-list',
    label: 'Bullet List',
  }, {
    kind: 'orderedList',
    icon: 'i-lucide-list-ordered',
    label: 'Ordered List',
  }],
}, {
  kind: 'blockquote',
  icon: 'i-lucide-text-quote',
  tooltip: { text: 'Blockquote' },
}], [{
  kind: 'mark',
  mark: 'bold',
  icon: 'i-lucide-bold',
  tooltip: { text: 'Bold' },
}, {
  kind: 'mark',
  mark: 'italic',
  icon: 'i-lucide-italic',
  tooltip: { text: 'Italic' },
}, {
  kind: 'mark',
  mark: 'underline',
  icon: 'i-lucide-underline',
  tooltip: { text: 'Underline' },
}, {
  kind: 'mark',
  mark: 'strike',
  icon: 'i-lucide-strikethrough',
  tooltip: { text: 'Strikethrough' },
}, {
  kind: 'mark',
  mark: 'code',
  icon: 'i-lucide-code',
  tooltip: { text: 'Code' },
}], [{
  slot: 'link' as const,
  icon: 'i-lucide-link',
}, {
  slot: 'imageUpload',
  icon: 'i-lucide-image',
  tooltip: { text: 'Image' },
}], [{
  icon: 'i-lucide-align-justify',
  tooltip: { text: 'Text Align' },
  content: {
    align: 'end',
  },
  items: [{
    kind: 'textAlign',
    align: 'left',
    icon: 'i-lucide-align-left',
    label: 'Align Left',
  }, {
    kind: 'textAlign',
    align: 'center',
    icon: 'i-lucide-align-center',
    label: 'Align Center',
  }, {
    kind: 'textAlign',
    align: 'right',
    icon: 'i-lucide-align-right',
    label: 'Align Right',
  }, {
    kind: 'textAlign',
    align: 'justify',
    icon: 'i-lucide-align-justify',
    label: 'Align Justify',
  }],
}]] satisfies EditorToolbarItem<typeof customHandlers>[][]

const bubbleToolbarItems = computed(() => [[{
  label: 'Turn into',
  trailingIcon: 'i-lucide-chevron-down',
  activeColor: 'neutral',
  activeVariant: 'ghost',
  tooltip: { text: 'Turn into' },
  content: {
    align: 'start',
  },
  ui: {
    label: 'text-xs',
  },
  items: [{
    type: 'label',
    label: 'Turn into',
  }, {
    kind: 'paragraph',
    label: 'Paragraph',
    icon: 'i-lucide-type',
  }, {
    kind: 'heading',
    level: 1,
    icon: 'i-lucide-heading-1',
    label: 'Heading 1',
  }, {
    kind: 'heading',
    level: 2,
    icon: 'i-lucide-heading-2',
    label: 'Heading 2',
  }, {
    kind: 'heading',
    level: 3,
    icon: 'i-lucide-heading-3',
    label: 'Heading 3',
  }, {
    kind: 'heading',
    level: 4,
    icon: 'i-lucide-heading-4',
    label: 'Heading 4',
  }, {
    kind: 'bulletList',
    icon: 'i-lucide-list',
    label: 'Bullet List',
  }, {
    kind: 'orderedList',
    icon: 'i-lucide-list-ordered',
    label: 'Ordered List',
  }, {
    kind: 'blockquote',
    icon: 'i-lucide-text-quote',
    label: 'Blockquote',
  }],
}], [{
  kind: 'mark',
  mark: 'bold',
  icon: 'i-lucide-bold',
  tooltip: { text: 'Bold' },
}, {
  kind: 'mark',
  mark: 'italic',
  icon: 'i-lucide-italic',
  tooltip: { text: 'Italic' },
}, {
  kind: 'mark',
  mark: 'underline',
  icon: 'i-lucide-underline',
  tooltip: { text: 'Underline' },
}, {
  kind: 'mark',
  mark: 'strike',
  icon: 'i-lucide-strikethrough',
  tooltip: { text: 'Strikethrough' },
}, {
  kind: 'mark',
  mark: 'code',
  icon: 'i-lucide-code',
  tooltip: { text: 'Code' },
}], [{
  slot: 'link' as const,
  icon: 'i-lucide-link',
}, {
  kind: 'imageUpload',
  icon: 'i-lucide-image',
  tooltip: { text: 'Image' },
}], [{
  icon: 'i-lucide-align-justify',
  tooltip: { text: 'Text Align' },
  content: {
    align: 'end',
  },
  items: [{
    kind: 'textAlign',
    align: 'left',
    icon: 'i-lucide-align-left',
    label: 'Align Left',
  }, {
    kind: 'textAlign',
    align: 'center',
    icon: 'i-lucide-align-center',
    label: 'Align Center',
  }, {
    kind: 'textAlign',
    align: 'right',
    icon: 'i-lucide-align-right',
    label: 'Align Right',
  }, {
    kind: 'textAlign',
    align: 'justify',
    icon: 'i-lucide-align-justify',
    label: 'Align Justify',
  }],
}]] satisfies EditorToolbarItem<typeof customHandlers>[][])

const selectedNode = ref<{ node: JSONContent, pos: number }>()

function handleItems(editor: Editor): DropdownMenuItem[][] {
  if (!selectedNode.value?.node?.type) {
    return []
  }

  return mapEditorItems(editor, [[
    {
      type: 'label',
      label: upperFirst(selectedNode.value.node.type),
    },
    {
      label: 'Turn into',
      icon: 'i-lucide-repeat-2',
      children: [
        { kind: 'paragraph', label: 'Paragraph', icon: 'i-lucide-type' },
        { kind: 'heading', level: 1, label: 'Heading 1', icon: 'i-lucide-heading-1' },
        { kind: 'heading', level: 2, label: 'Heading 2', icon: 'i-lucide-heading-2' },
        { kind: 'heading', level: 3, label: 'Heading 3', icon: 'i-lucide-heading-3' },
        { kind: 'heading', level: 4, label: 'Heading 4', icon: 'i-lucide-heading-4' },
        { kind: 'bulletList', label: 'Bullet List', icon: 'i-lucide-list' },
        { kind: 'orderedList', label: 'Ordered List', icon: 'i-lucide-list-ordered' },
        { kind: 'blockquote', label: 'Blockquote', icon: 'i-lucide-text-quote' },
      ],
    },
    {
      kind: 'clearFormatting',
      pos: selectedNode.value?.pos,
      label: 'Reset formatting',
      icon: 'i-lucide-rotate-ccw',
    },
  ], [
    {
      kind: 'duplicate',
      pos: selectedNode.value?.pos,
      label: 'Duplicate',
      icon: 'i-lucide-copy',
    },
    {
      label: 'Copy to clipboard',
      icon: 'i-lucide-clipboard',
      onSelect: async () => {
        if (!selectedNode.value)
          return

        const pos = selectedNode.value.pos
        const node = editor.state.doc.nodeAt(pos)
        if (node) {
          await navigator.clipboard.writeText(node.textContent)
        }
      },
    },
  ], [
    {
      kind: 'moveUp',
      pos: selectedNode.value?.pos,
      label: 'Move up',
      icon: 'i-lucide-arrow-up',
    },
    {
      kind: 'moveDown',
      pos: selectedNode.value?.pos,
      label: 'Move down',
      icon: 'i-lucide-arrow-down',
    },
  ], [
    {
      kind: 'delete',
      pos: selectedNode.value?.pos,
      label: 'Delete',
      icon: 'i-lucide-trash',
    },
  ], ...(selectedNode.value?.node?.type === 'image' ? [[{ label: 'Add caption', icon: 'i-lucide-type', onSelect: () => editor.chain().focus().imageToFigure().run() }]] : selectedNode.value?.node?.type === 'figure' ? [[{ label: 'Remove caption', icon: 'i-lucide-align-justify', onSelect: () => editor.chain().focus().figureToImage().run() }]] : [])], customHandlers) as DropdownMenuItem[][]
}

const suggestionItems = [[{
  type: 'label',
  label: 'AI',
}, {
  kind: 'aiContinue',
  label: 'Continue writing',
  icon: 'i-lucide-sparkles',
}], [{
  type: 'label',
  label: 'Style',
}, {
  kind: 'paragraph',
  label: 'Paragraph',
  icon: 'i-lucide-type',
}, {
  kind: 'heading',
  level: 1,
  label: 'Heading 1',
  icon: 'i-lucide-heading-1',
}, {
  kind: 'heading',
  level: 2,
  label: 'Heading 2',
  icon: 'i-lucide-heading-2',
}, {
  kind: 'heading',
  level: 3,
  label: 'Heading 3',
  icon: 'i-lucide-heading-3',
}, {
  kind: 'bulletList',
  label: 'Bullet List',
  icon: 'i-lucide-list',
}, {
  kind: 'orderedList',
  label: 'Numbered List',
  icon: 'i-lucide-list-ordered',
}, {
  kind: 'blockquote',
  label: 'Blockquote',
  icon: 'i-lucide-text-quote',
}], [{
  type: 'label',
  label: 'Insert',
}, {
  kind: 'imageUpload',
  label: 'Image',
  icon: 'i-lucide-image',
}, {
  kind: 'horizontalRule',
  label: 'Horizontal Rule',
  icon: 'i-lucide-separator-horizontal',
}]] satisfies EditorSuggestionMenuItem<typeof customHandlers>[][]
</script>

<template>
  <UEditor
    ref="editorRef"
    v-slot="{ editor, handlers }"
    v-model="value"
    content-type="html"
    :extensions="[
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      AdvancedImage.configure({
        HTMLAttributes: {
          class: 'content-image',
        },
      }),
      Figure,
      MediaText,
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf'],
        onDrop: (currentEditor, files, pos) => {
          return handleFiles(files, currentEditor as Editor, undefined, pos)
        },
        onPaste: (currentEditor, files) => {
          return handleFiles(files, currentEditor as Editor)
        },
      },
      ),
    ]"
    :handlers="customHandlers"
    placeholder="Write, type '/' for commands..."
    :ui="{ base: 'p-8 sm:px-16 py-13.5' }"
    class="w-full"
  >
    <UEditorToolbar :editor="editor" :items="fixedToolbarItems" class="border-b border-muted sticky top-0 inset-x-0 px-8 sm:px-16 py-2 z-50 bg-default overflow-x-auto">
      <template #link>
        <EditorLinkPopover :editor="editor" auto-open />
      </template>
      <template #imageUpload>
        <EditorImagePopover :editor="editor" auto-open />
      </template>
    </UEditorToolbar>

    <UEditorToolbar
      :editor="editor"
      :items="bubbleToolbarItems"
      layout="bubble"
      :should-show="({ editor, view, state }) => {
        if (editor.isActive('imageUpload') || editor.isActive('image') || editor.isActive('figure')) {
          return false
        }
        const { selection } = state
        return view.hasFocus() && !selection.empty
      }"
    >
      <template #link>
        <EditorLinkPopover :editor="editor" />
      </template>
    </UEditorToolbar>

    <UEditorToolbar
      :editor="editor"
      :items="imageToolbarItems(editor)"
      layout="bubble"
      :should-show="({ editor, view }) => {
        return (editor.isActive('image') || editor.isActive('figure')) && view.hasFocus()
      }"
    />

    <UEditorDragHandle v-slot="{ ui, onClick }" :editor="editor" @node-change="selectedNode = $event">
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="sm"
        :class="ui.handle()"
        @click="(e) => {
          e.stopPropagation()

          const selected = onClick()
          handlers.suggestion?.execute(editor, { pos: selected?.pos }).run()
        }"
      />

      <UDropdownMenu
        v-slot="{ open }"
        :modal="false"
        :items="handleItems(editor)"
        :content="{ side: 'left' }"
        :ui="{ content: 'w-48', label: 'text-xs' }"
        @update:open="editor.chain().setMeta('lockDragHandle', $event).run()"
      >
        <UButton
          color="neutral"
          variant="ghost"
          active-variant="soft"
          size="sm"
          icon="i-lucide-grip-vertical"
          :active="open"
          :class="ui.handle()"
        />
      </UDropdownMenu>
    </UEditorDragHandle>

    <UEditorSuggestionMenu :editor="editor" :items="suggestionItems" />
  </UEditor>
</template>

<style>
.tiptap .content-image{
  display: inline-block;
}
.tiptap {
  display: flow-root;
}

.media-text-left,
.media-text-right {
  display: grid;
  column-gap: 1.5rem;
  row-gap: 0;
  margin: 1.5rem 0;
  align-items: start;
}
.media-text-left {
  grid-template-columns: 1fr 1fr;
}
.media-text-right {
  grid-template-columns: 1fr 1fr;
}
.media-text-left > *:first-child {
  grid-column: 1;
  grid-row: 1 / span 100;
  width: 100%;
}
.media-text-left > *:not(:first-child) {
  grid-column: 2;
}
.media-text-right > *:first-child {
  grid-column: 2;
  grid-row: 1 / span 100;
  width: 100%;
}
.media-text-right > *:not(:first-child) {
  grid-column: 1;
}

/* Figure (image with caption) */
.tiptap figure {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
  width: 100%;
  max-width: 100%;
}
.tiptap figure > img {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  margin: 0;
  object-fit: contain;
}
.tiptap figure figcaption {
  padding: 0.5rem;
  font-size: 0.875rem;
  color: var(--ui-text-dimmed, #6b7280);
  text-align: center;
  outline: none;
}
.tiptap figure.ProseMirror-selectednode,
.tiptap figure:has(figcaption:focus) {
  outline: 2px solid var(--ui-primary, #3b82f6);
  border-radius: 0.375rem;
}
</style>
