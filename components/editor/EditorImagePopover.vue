<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { handleFiles } from './FileUpload'

const props = defineProps<{
  editor: Editor
  autoOpen?: boolean
  uploadPrefix?: string
}>()

function getImageDimensions(src: string): Promise<{ width: number, height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const open = ref(false)
const url = ref('')
const alt = ref('')
const caption = ref('')
const width = ref('')
const height = ref('')
const file = ref<File | null>(null)
const isUploading = ref(false)

const syncFromSelectionRef = ref<(() => void) | null>(null)

const active = computed(() => props.editor.isActive('image') || props.editor.isActive('figure'))

const disabled = computed(() => {
  if (!props.editor.isEditable)
    return true
  return false
})

watch(() => props.editor, (editor, _, onCleanup) => {
  if (!editor)
    return

  const syncFromSelection = () => {
    if (editor.isActive('figure')) {
      const attrs = editor.getAttributes('figure')
      url.value = attrs.src || ''
      alt.value = attrs.alt || ''
      width.value = attrs.width != null ? String(attrs.width) : ''
      height.value = attrs.height != null ? String(attrs.height) : ''
      caption.value = ''
      const { state } = editor
      const { selection } = state
      const sel = selection as { node?: { type?: { name?: string }, textContent?: string } }
      if (sel?.node?.type?.name === 'figure') {
        caption.value = sel.node.textContent ?? ''
      }
      else {
        const { $from } = selection
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'figure') {
            caption.value = $from.node(d).textContent
            break
          }
        }
      }
    }
    else if (editor.isActive('image')) {
      const attrs = editor.getAttributes('image')
      url.value = attrs.src || ''
      alt.value = attrs.alt || ''
      width.value = attrs.width != null ? String(attrs.width) : ''
      height.value = attrs.height != null ? String(attrs.height) : ''
      caption.value = ''
    }
    else {
      url.value = ''
      alt.value = ''
      caption.value = ''
      width.value = ''
      height.value = ''
    }
  }

  syncFromSelectionRef.value = syncFromSelection
  syncFromSelection()
  editor.on('selectionUpdate', syncFromSelection)

  onCleanup(() => {
    syncFromSelectionRef.value = null
    editor.off('selectionUpdate', syncFromSelection)
  })
}, { immediate: true })

watch(open, (isOpen) => {
  if (isOpen && syncFromSelectionRef.value)
    nextTick(syncFromSelectionRef.value)
})

async function setImageFromUrl() {
  if (!url.value)
    return

  const hasCaption = caption.value.trim().length > 0
  const altVal = alt.value.trim() || null
  let widthVal: number | null = (width.value === '' || width.value == null) ? null : Number(width.value)
  let heightVal: number | null = (height.value === '' || height.value == null) ? null : Number(height.value)
  const needDims = (widthVal == null || heightVal == null || Number.isNaN(widthVal) || Number.isNaN(heightVal))
  if (needDims && url.value) {
    const dims = await getImageDimensions(url.value)
    if (dims) {
      if (widthVal == null || Number.isNaN(widthVal))
        widthVal = dims.width
      if (heightVal == null || Number.isNaN(heightVal))
        heightVal = dims.height
    }
  }
  const sizeAttrs = {
    ...(widthVal != null && !Number.isNaN(widthVal) ? { width: widthVal } : {}),
    ...(heightVal != null && !Number.isNaN(heightVal) ? { height: heightVal } : {}),
  }

  if (props.editor.isActive('figure')) {
    props.editor.chain().focus().updateAttributes('figure', { src: url.value, alt: altVal, ...sizeAttrs }).run()
    props.editor.chain().focus().updateFigureCaption(caption.value.trim()).run()
  }
  else if (props.editor.isActive('image')) {
    if (hasCaption) {
      props.editor.chain().focus().imageToFigure({ caption: caption.value.trim() }).run()
      props.editor.chain().focus().updateAttributes('figure', { src: url.value, alt: altVal, ...sizeAttrs }).run()
    }
    else {
      props.editor.chain().focus().updateAttributes('image', { src: url.value, alt: altVal, ...sizeAttrs }).run()
    }
  }
  else if (hasCaption) {
    props.editor.chain().focus().setFigure({ src: url.value, caption: caption.value.trim(), alt: altVal ?? undefined, ...sizeAttrs }).run()
  }
  else {
    props.editor
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: url.value, alt: altVal ?? undefined, ...sizeAttrs } })
      .run()
  }

  url.value = ''
  alt.value = ''
  caption.value = ''
  width.value = ''
  height.value = ''
  open.value = false
}

function openLink() {
  if (!url.value)
    return
  window.open(url.value, '_blank', 'noopener,noreferrer')
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    setImageFromUrl()
  }
}

watch(file, async (newFile) => {
  if (!newFile)
    return
  const pendingAlt = alt.value.trim() || null
  const pendingCaption = caption.value.trim() || null
  isUploading.value = true
  const imagePos = await handleFiles([newFile], props.editor, props.uploadPrefix, undefined, {
    alt: pendingAlt,
    caption: pendingCaption,
  })
  isUploading.value = false
  file.value = null
  if (imagePos != null) {
    props.editor.chain().focus().setNodeSelection(imagePos).run()
    await nextTick()
    const isFig = props.editor.isActive('figure')
    const attrs = props.editor.getAttributes(isFig ? 'figure' : 'image')
    url.value = attrs.src ?? ''
    alt.value = attrs.alt ?? ''
    width.value = attrs.width != null ? String(attrs.width) : ''
    height.value = attrs.height != null ? String(attrs.height) : ''
    caption.value = isFig ? ((props.editor.state.selection as { node?: { textContent?: string } }).node?.textContent ?? '') : ''
    const src = attrs.src
    if (src && (attrs.width == null || attrs.height == null)) {
      const dims = await getImageDimensions(src)
      if (dims) {
        const nodeType = isFig ? 'figure' : 'image'
        props.editor.chain().focus().updateAttributes(nodeType, {
          width: attrs.width ?? dims.width,
          height: attrs.height ?? dims.height,
        }).run()
        width.value = String(attrs.width ?? dims.width)
        height.value = String(attrs.height ?? dims.height)
      }
    }
  }
  if (imagePos == null)
    open.value = false
})
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'p-0.5' }">
    <UTooltip text="Image">
      <UButton
        icon="i-lucide-image"
        color="neutral"
        active-color="primary"
        variant="ghost"
        active-variant="soft"
        size="sm"
        :active="active"
        :disabled="disabled"
      />
    </UTooltip>

    <template #content>
      <div v-if="isUploading" class="flex flex-col items-center justify-center gap-4 h-36">
        <UIcon name="i-lucide-loader-circle" class="animate-spin" />
        <div class="text-sm font-medium">
          Uploading...
        </div>
        <div class="text-sm text-neutral-500">
          {{ file?.name }}
        </div>
      </div>
      <UFileUpload
        v-else
        v-model="file"
        icon="i-lucide-image"
        accept="image/*"
        label="Upload an image"
        :preview="false"
      />
      <div class="flex flex-col gap-2 p-2 min-w-64">
        <template v-if="!active">
          <UInput
            v-model="url"
            autofocus
            name="url"
            type="url"
            variant="none"
            placeholder="Or paste image URL..."
            @keydown="handleKeyDown"
          >
            <div class="flex items-center mr-0.5">
              <UButton
                icon="i-lucide-corner-down-left"
                variant="ghost"
                size="sm"
                :disabled="!url"
                title="Insert image"
                @click="setImageFromUrl"
              />

              <USeparator orientation="vertical" class="h-6 mx-1" />

              <UButton
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="!url"
                title="Open in new window"
                @click="openLink"
              />
            </div>
          </UInput>
        </template>
        <UFormField label="Alt text (optional)">
          <UInput
            v-model="alt"
            name="alt"
            class="w-full"
            variant="outline"
            placeholder="Describe the image for screen readers"
            @keydown.enter.prevent="setImageFromUrl"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Width">
            <UInput
              v-model="width"
              name="width"
              type="number"
              class="w-full"
              variant="outline"
              placeholder="Auto"
              min="1"
              @keydown.enter.prevent="setImageFromUrl"
            />
          </UFormField>
          <UFormField label="Height">
            <UInput
              v-model="height"
              name="height"
              type="number"
              class="w-full"
              variant="outline"
              placeholder="Auto"
              min="1"
              @keydown.enter.prevent="setImageFromUrl"
            />
          </UFormField>
        </div>
        <UFormField label="Caption (optional)">
          <UInput
            v-model="caption"
            name="caption"
            class="w-full"
            variant="outline"
            placeholder="Add a caption for the image"
            @keydown.enter.prevent="setImageFromUrl"
          />
        </UFormField>
      </div>
    </template>
  </UPopover>
</template>
