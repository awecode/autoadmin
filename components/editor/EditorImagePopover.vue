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
const file = ref<File | null>(null)
const isUploading = ref(false)

const disabled = computed(() => {
  if (!props.editor.isEditable)
    return true
  return false
})

watch(() => props.editor, (editor, _, onCleanup) => {
  if (!editor)
    return

  const updateUrl = () => {
    if (editor.isActive('image')) {
      url.value = editor.getAttributes('image').src || ''
    }
    else {
      url.value = editor.getAttributes('link').href || ''
    }
  }

  updateUrl()
  editor.on('selectionUpdate', updateUrl)

  onCleanup(() => {
    editor.off('selectionUpdate', updateUrl)
  })
}, { immediate: true })

function setImageFromUrl() {
  if (!url.value)
    return

  if (props.editor.isActive('image')) {
    props.editor.chain().focus().updateAttributes('image', { src: url.value }).run()
  }
  else {
    props.editor
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: url.value } })
      .run()
  }
  url.value = ''
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
  isUploading.value = true
  await handleFiles([newFile], props.editor, props.uploadPrefix)
  isUploading.value = false
  file.value = null
  open.value = false
})
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'p-0.5' }">
    <UTooltip text="Image">
      <UButton
        icon="i-lucide-image"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="disabled"
      />
    </UTooltip>

    <template #content>
      <UInput
        v-model="url"
        autofocus
        name="url"
        type="url"
        variant="none"
        placeholder="Paste link to image..."
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
        label="Upload an image..."
        description="SVG, PNG, JPG or GIF (max. 2MB)"
        :preview="false"
      />
    </template>
  </UPopover>
</template>
