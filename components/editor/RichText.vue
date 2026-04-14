<script setup lang="ts">
import type { DropdownMenuItem, EditorSuggestionMenuItem, EditorToolbarItem } from '@nuxt/ui'
import type { Editor, JSONContent } from '@tiptap/vue-3'
import { mapEditorItems } from '@nuxt/ui/utils/editor'
import FileHandler from '@tiptap/extension-file-handler'
import { TableKit } from '@tiptap/extension-table'
import { TextAlign } from '@tiptap/extension-text-align'
import { upperFirst } from 'scule'
import { AdvancedImage, imageToolbarItems } from './AdvancedImage'
import EditorEmbedPopover from './EditorEmbedPopover.vue'
import EditorImagePopover from './EditorImagePopover.vue'
import EditorLinkPopover from './EditorLinkPopover.vue'
import EditorTablePopover from './EditorTablePopover.vue'
import { Embed } from './Embed'
import { Figure } from './Figure'
import { handleFiles } from './FileUpload'
import { MediaText } from './MediaText'
import { tableToolbarItems } from './TableToolbar'

const props = defineProps<{
  attrs?: Record<string, any>
  clientConfig?: Record<string, any>
  uploadPrefix?: string
}>()

const uploadPrefix = props.uploadPrefix || 'content/'

const value = defineModel<string>({ default: '' })
const supportedHeadingLevels = [1, 2, 3, 4] as const

// Merge: clientConfig (global + per-field) < attrs (server-side inputAttrs)
// Arrays (extensions, toolbar items) are concatenated rather than replaced
const clientCfg = props.clientConfig ?? {}
const serverAttrs = props.attrs ?? {}

const merged: Record<string, any> = { ...clientCfg }
for (const [key, val] of Object.entries(serverAttrs)) {
  if (val !== undefined) {
    merged[key] = val
  }
}
// Concatenate array-type options from both sources
for (const arrayKey of ['extraFixedToolbarItems', 'extraBubbleToolbarItems', 'extensions'] as const) {
  const client = (clientCfg as any)[arrayKey] as any[] | undefined
  const server = (serverAttrs as any)[arrayKey] as any[] | undefined
  if (client || server) {
    merged[arrayKey] = [...(client ?? []), ...(server ?? [])]
  }
}

const {
  disabledHeadingLevels: rawDisabledHeadingLevels,
  extraFixedToolbarItems: rawExtraFixedItems,
  extraBubbleToolbarItems: rawExtraBubbleItems,
  allowedMimeTypes: rawAllowedMimeTypes,
  textAlignTypes: rawTextAlignTypes,
  extensions: rawExtensions,
  embedTypes: rawEmbedTypes,
  baseClass,
  toolbarClass,
  ...editorAttrs
} = merged

const extraFixedItems = (rawExtraFixedItems ?? []) as EditorToolbarItem[][]
const extraBubbleItems = (rawExtraBubbleItems ?? []) as EditorToolbarItem[][]
const allowedMimeTypes = (rawAllowedMimeTypes ?? ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']) as string[]
const textAlignTypes = (rawTextAlignTypes ?? ['heading', 'paragraph']) as string[]
const extraExtensions = (rawExtensions ?? []) as any[]
const embedTypes = rawEmbedTypes as any[] | undefined

const disabledHeadingLevels = Array.isArray(rawDisabledHeadingLevels)
  ? rawDisabledHeadingLevels
      .map(level => Number(level))
      .filter((level): level is number => supportedHeadingLevels.includes(level as typeof supportedHeadingLevels[number]))
  : []

const enabledHeadingLevels = supportedHeadingLevels.filter(level => !disabledHeadingLevels.includes(level))

const headingItems: EditorToolbarItem[] = enabledHeadingLevels.map(level => ({
  kind: 'heading',
  level,
  icon: `i-lucide-heading-${level}`,
  label: `Heading ${level}`,
}))

const blockTypeItems: EditorToolbarItem[] = [
  {
    kind: 'paragraph',
    label: 'Paragraph',
    icon: 'i-lucide-type',
  },
  ...headingItems,
  {
    kind: 'bulletList',
    icon: 'i-lucide-list',
    label: 'Bullet List',
  },
  {
    kind: 'orderedList',
    icon: 'i-lucide-list-ordered',
    label: 'Ordered List',
  },
  {
    kind: 'blockquote',
    icon: 'i-lucide-quote',
    label: 'Blockquote',
  },
]

const blockTypeSuggestionItems: EditorSuggestionMenuItem[] = [
  {
    kind: 'paragraph',
    label: 'Paragraph',
    icon: 'i-lucide-type',
  },
  ...enabledHeadingLevels.map(level => ({
    kind: 'heading',
    level,
    label: `Heading ${level}`,
    icon: `i-lucide-heading-${level}`,
  })),
  {
    kind: 'bulletList',
    label: 'Bullet List',
    icon: 'i-lucide-list',
  },
  {
    kind: 'orderedList',
    label: 'Numbered List',
    icon: 'i-lucide-list-ordered',
  },
  {
    kind: 'blockquote',
    label: 'Blockquote',
    icon: 'i-lucide-quote',
  },
]

const headingDropdownItem: EditorToolbarItem | undefined = headingItems.length
  ? {
      icon: 'i-lucide-heading',
      tooltip: { text: 'Headings' },
      content: {
        align: 'start',
      },
      items: headingItems,
    }
  : undefined

const starterKitOptions = {
  heading: enabledHeadingLevels.length > 0
    ? { levels: [...enabledHeadingLevels] }
    : false as const,
}

const fixedToolbarItems: EditorToolbarItem[][] = [[{
  kind: 'undo',
  icon: 'i-lucide-undo',
  tooltip: { text: 'Undo' },
}, {
  kind: 'redo',
  icon: 'i-lucide-redo',
  tooltip: { text: 'Redo' },
}], [
  ...(headingDropdownItem ? [headingDropdownItem] : []),
  {
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
  },
  {
    kind: 'blockquote',
    icon: 'i-lucide-quote',
    tooltip: { text: 'Blockquote' },
  },
], [{
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
}, {
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
}], [{
  slot: 'link' as const,
  icon: 'i-lucide-link',
}, {
  slot: 'image' as const,
  icon: 'i-lucide-image',
  tooltip: { text: 'Image' },
}, {
  slot: 'embed' as const,
  icon: 'i-lucide-square-dashed-bottom-code',
  tooltip: { text: 'Embed' },
}, {
  slot: 'table' as const,
  icon: 'i-lucide-table',
  tooltip: { text: 'Table' },
}], ...extraFixedItems]

const bubbleToolbarItems: EditorToolbarItem[][] = [[{
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
  }, ...blockTypeItems],
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
}, {
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
}], [{
  slot: 'link' as const,
  icon: 'i-lucide-link',
}], ...extraBubbleItems]

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
      children: blockTypeItems,
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
  ], ...(selectedNode.value?.node?.type === 'image' ? [[{ label: 'Add caption', icon: 'i-lucide-type', onSelect: () => editor.chain().focus().imageToFigure().run() }]] : selectedNode.value?.node?.type === 'figure' ? [[{ label: 'Remove caption', icon: 'i-lucide-panel-top', onSelect: () => editor.chain().focus().figureToImage().run() }]] : [])]) as DropdownMenuItem[][]
}

const suggestionItems: EditorSuggestionMenuItem[][] = [[{
  type: 'label',
  label: 'Style',
}, ...blockTypeSuggestionItems], [{
  type: 'label',
  label: 'Insert',
}, {
  kind: 'horizontalRule',
  label: 'Horizontal Rule',
  icon: 'i-lucide-separator-horizontal',
}]]
</script>

<template>
  <UEditor
    v-slot="{ editor, handlers }"
    v-model="value"
    v-bind="editorAttrs"
    content-type="html"
    :image="false"
    :starter-kit="starterKitOptions"
    :extensions="[
      TableKit,
      TextAlign.configure({ types: textAlignTypes }),
      Embed,
      AdvancedImage.configure({
        HTMLAttributes: {
          class: 'content-image',
        },
      }),
      Figure,
      MediaText,
      FileHandler.configure({
        allowedMimeTypes,
        onDrop: (currentEditor, files, pos) => {
          return handleFiles(files, currentEditor as Editor, uploadPrefix, pos)
        },
        onPaste: (currentEditor, files) => {
          return handleFiles(files, currentEditor as Editor, uploadPrefix)
        },
      }),
      ...extraExtensions,
    ]"
    :placeholder="editorAttrs?.placeholder || 'Write, type / for commands...'"
    :ui="{ base: baseClass ?? 'p-8 sm:px-16 py-13.5 prose dark:prose-invert max-w-none' }"
    class="min-h-48"
  >
    <UEditorToolbar :editor="editor" :items="fixedToolbarItems" :class="toolbarClass ?? 'border-b border-muted sticky top-0 inset-x-0 px-8 sm:px-16 py-2 z-50 bg-default overflow-x-auto'">
      <template #link>
        <EditorLinkPopover :editor="editor" auto-open />
      </template>
      <template #image>
        <EditorImagePopover :editor="editor" :upload-prefix="uploadPrefix" auto-open />
      </template>
      <template #embed>
        <EditorEmbedPopover :editor="editor" :upload-prefix="uploadPrefix" :enabled-types="embedTypes" auto-open />
      </template>
      <template #table>
        <EditorTablePopover :editor="editor" />
      </template>
    </UEditorToolbar>

    <UEditorToolbar
      :editor="editor"
      :items="bubbleToolbarItems"
      layout="bubble"
      :should-show="({ editor, view, state }) => {
        if (editor.isActive('image') || editor.isActive('figure') || editor.isActive('embed')) {
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
      :should-show="({ editor, view, state }) => {
        if (!view.hasFocus())
          return false
        if (editor.isActive('image') && !editor.isActive('figure'))
          return true
        const sel = state.selection as { node?: { type?: { name?: string } } }
        if (sel?.node?.type?.name === 'figure')
          return true
        return false
      }"
    />

    <UEditorToolbar
      :editor="editor"
      :items="tableToolbarItems(editor)"
      layout="bubble"
      :should-show="({ editor }) => editor.isActive('table')"
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
@import '../../assets/css/rich-media-text.css';
@import '../../assets/css/rich-embed.css';

.tiptap .embed-node.ProseMirror-selectednode {
  outline: 2px solid var(--ui-primary, #3b82f6);
  border-radius: 0.375rem;
}

.tiptap img{
  /* display: inline-block; */
  height: auto;
  max-width: 100%;
}

/* Figure (image with caption) */
.tiptap figure {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
  width: fit-content;
  max-width: 100%;
}
.tiptap figure > img {
  display: block;
  height: auto;
  max-width: 100%;
  object-fit: contain;
}
.tiptap figure figcaption {
  color: var(--ui-text-dimmed, #6b7280);
}
.tiptap figure.ProseMirror-selectednode,
.tiptap figure:has(figcaption:focus) {
  outline: 2px solid var(--ui-primary, #3b82f6);
  border-radius: 0.375rem;
}

/* Table-specific styling */
.tiptap table {
  border-collapse: collapse;
  margin: 0;
  overflow: hidden;
  table-layout: fixed;
  width: 100%;
}
.tiptap table td,
.tiptap table th {
  border: 1px solid var(--ui-color-neutral-200);
  box-sizing: border-box;
  min-width: 1em;
  padding: 6px 8px;
  position: relative;
  vertical-align: top;
}
.tiptap table td > *,
.tiptap table th > * {
  margin-bottom: 0;
}
.tiptap table th {
  background-color: var(--ui-color-neutral-100);
  font-weight: bold;
  text-align: left;
}
.tiptap table .selectedCell:after {
  background: var(--ui-color-neutral-300);
  content: '';
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}
.tiptap .tableWrapper {
  margin: 1.5rem 0;
  overflow-x: auto;
}
</style>
