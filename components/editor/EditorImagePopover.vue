<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { handleFiles } from './FileUpload'

const props = defineProps<{
  editor: Editor
  autoOpen?: boolean
  uploadPrefix?: string
}>()

const open = ref(false)
const url = ref('')
const alt = ref('')
const caption = ref('')
const file = ref<File | null>(null)
const isUploading = ref(false)

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
      caption.value = ''
    }
    else {
      url.value = ''
      alt.value = ''
      caption.value = ''
    }
  }

  syncFromSelection()
  editor.on('selectionUpdate', syncFromSelection)

  onCleanup(() => {
    editor.off('selectionUpdate', syncFromSelection)
  })
}, { immediate: true })

function setImageFromUrl() {
  if (!url.value)
    return

  const hasCaption = caption.value.trim().length > 0
  const altVal = alt.value.trim() || null

  if (props.editor.isActive('figure')) {
    props.editor.chain().focus().updateAttributes('figure', { src: url.value, alt: altVal }).run()
    props.editor.chain().focus().updateFigureCaption(caption.value.trim()).run()
  }
  else if (props.editor.isActive('image')) {
    if (hasCaption) {
      props.editor.chain().focus().imageToFigure({ caption: caption.value.trim() }).run()
      props.editor.chain().focus().updateAttributes('figure', { src: url.value, alt: altVal }).run()
    }
    else {
      props.editor.chain().focus().updateAttributes('image', { src: url.value, alt: altVal }).run()
    }
  }
  else if (hasCaption) {
    props.editor.chain().focus().setFigure({ src: url.value, caption: caption.value.trim(), alt: altVal ?? undefined }).run()
  }
  else {
    props.editor
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: url.value, alt: altVal ?? undefined } })
      .run()
  }
  url.value = ''
  alt.value = ''
  caption.value = ''
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
    caption.value = isFig ? ((props.editor.state.selection as { node?: { textContent?: string } }).node?.textContent ?? '') : ''
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
        <UFormField label="Alt text(optional)">
          <UInput
            v-model="alt"
            name="alt"
            class="w-full"
            variant="outline"
            placeholder="Describe the image for screen readers"
            @keydown.enter.prevent="setImageFromUrl"
          />
        </UFormField>
        <UFormField label="Caption(optional)">
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
