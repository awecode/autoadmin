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

const active = computed(() => props.editor.isActive('link'))
const disabled = computed(() => {
  if (!props.editor.isEditable)
    return true
  return false
})

watch(() => props.editor, (editor, _, onCleanup) => {
  if (!editor)
    return

  const updateUrl = () => {
    const { href } = editor.getAttributes('link')
    url.value = href || ''
  }

  updateUrl()
  editor.on('selectionUpdate', updateUrl)

  onCleanup(() => {
    editor.off('selectionUpdate', updateUrl)
  })
}, { immediate: true })

watch(active, (isActive) => {
  if (isActive && props.autoOpen) {
    open.value = true
  }
})

function setLink() {
  if (!url.value)
    return

  const { selection } = props.editor.state
  const isEmpty = selection.empty
  const hasCode = props.editor.isActive('code')

  let chain = props.editor.chain().focus()

  // When linking code, extend the code mark range first to select the full code
  if (hasCode && !isEmpty) {
    chain = chain.extendMarkRange('code').setLink({ href: url.value })
  }
  else {
    chain = chain.extendMarkRange('link').setLink({ href: url.value })

    if (isEmpty) {
      chain = chain.insertContent({ type: 'text', text: url.value })
    }
  }

  chain.run()
  open.value = false
}

function removeLink() {
  props.editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .unsetLink()
    .setMeta('preventAutolink', true)
    .run()

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
    setLink()
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
        active-color="primary"
        variant="ghost"
        active-variant="soft"
        size="sm"
        :active="active"
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
        placeholder="Paste a link..."
        @keydown="handleKeyDown"
      >
        <div class="flex items-center mr-0.5">
          <UButton
            icon="i-lucide-corner-down-left"
            variant="ghost"
            size="sm"
            :disabled="!url && !active"
            title="Apply link"
            @click="setLink"
          />

          <USeparator orientation="vertical" class="h-6 mx-1" />

          <UButton
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="!url && !active"
            title="Open in new window"
            @click="openLink"
          />

          <UButton
            icon="i-lucide-trash"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="!url && !active"
            title="Remove link"
            @click="removeLink"
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
