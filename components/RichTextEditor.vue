<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import FileHandler from '@tiptap/extension-file-handler'
import Image from '@tiptap/extension-image'
import { ListItem } from '@tiptap/extension-list'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'

const props = defineProps<{
  modelValue?: string
  attrs?: Record<string, any>
  uploadPrefix?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const enableImageUpload = true

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const isEditingHtml = ref(false)
const isUploading = ref(false)
const fileInput = useTemplateRef('fileInput')

const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)

  const params = new URLSearchParams({
    prefix: props.uploadPrefix || 'uploads/',
    fileType: file.type,
  })

  try {
    isUploading.value = true
    const response = await fetch(`${apiPrefix}/file-upload?${params}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const result = await response.text()
    return result
  } catch (error) {
    // eslint-disable-next-line no-alert
    window.alert(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  } finally {
    isUploading.value = false
  }
}

const handleFiles = async (currentEditor: Editor, files: File[], pos: number) => {
  files.forEach(async (file) => {
    try {
      const uploadedUrl = await uploadFile(file)
      currentEditor
        .chain()
        .insertContentAt(pos, {
          type: 'image',
          attrs: {
            src: uploadedUrl,
          },
        })
        .focus()
        .run()
    } catch (error) {
      // Error already handled in uploadFile function
      console.error('Failed to upload file:', error)
    }
  })
}

const editor = useEditor({
  content: props.modelValue || '',
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none dark:prose-invert min-h-[200px] p-4',
    },
  },
  extensions: [
    Placeholder.configure({
      placeholder: props.attrs?.placeholder,
      emptyEditorClass:
    'cursor-text before:content-[attr(data-placeholder)] before:absolute before:top-4 before:left-4 before:opacity-50 before-pointer-events-none text-sm',
    }),
    Color.configure({ types: [TextStyle.name, ListItem.name] }),
    TextStyle,
    StarterKit,
    Image,
    ...(enableImageUpload
      ? [FileHandler.configure({
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
          onDrop: (currentEditor, files, pos) => {
            return handleFiles(currentEditor, files, pos)
          },
          onPaste: (currentEditor, files) => {
            return handleFiles(currentEditor, files, currentEditor.state.selection.anchor)
          },
        })]
      : []),
  ],
  onUpdate: ({ editor: editorInstance }) => {
    if (isEditingHtml.value) {
      emit('update:modelValue', editorInstance.getText())
    } else {
      emit('update:modelValue', editorInstance.getHTML())
    }
  },
})

const openImageSelector = () => {
  if (!enableImageUpload) return
  fileInput.value?.click()
}

const handleFileSelection = (event: Event) => {
  if (!enableImageUpload) return
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0 && editor.value) {
    const fileArray = Array.from(files)
    const pos = editor.value.state.selection.anchor
    handleFiles(editor.value, fileArray, pos)
    // Clear the input so the same file can be selected again
    input.value = ''
  }
}

const toggleEditHtml = () => {
  isEditingHtml.value = !isEditingHtml.value
  if (isEditingHtml.value) {
    editor.value?.commands.setContent(`<textarea>${editor.value?.getHTML()}</textarea>`)
  } else {
    editor.value?.commands.setContent(editor.value?.getText())
  }
}

watch(() => props.modelValue, (value) => {
  if (!editor.value) return
  const isSame = editor.value.getHTML() === value
  if (isSame) return
  editor.value.commands.setContent(value ?? '')
})
</script>

<template>
  <div v-bind="attrs" class="min-h-[265px] border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
    <div v-if="editor">
      <!-- Toolbar -->
      <div class="toolbar flex flex-wrap gap-1 p-3 border-b bg-gray-50 dark:bg-gray-800">
        <button
          type="button"
          :data-active="editor.isActive('bold')"
          :disabled="!editor.can().chain().focus().toggleBold().run()"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Icon name="lucide:bold" />
        </button>

        <button
          type="button"
          :data-active="editor.isActive('italic')"
          :disabled="!editor.can().chain().focus().toggleItalic().run()"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Icon name="lucide:italic" />
        </button>

        <button
          type="button"
          :data-active="editor.isActive('strike')"
          :disabled="!editor.can().chain().focus().toggleStrike().run()"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <Icon name="lucide:strikethrough" />
        </button>

        <button
          type="button"
          :data-active="editor.isActive('underline')"
          :disabled="!editor.can().chain().focus().toggleUnderline().run()"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <Icon name="lucide:underline" />
        </button>

        <div data-divider></div>

        <button
          data-text-btn="true"
          type="button"
          :data-active="editor.isActive('heading', { level: 1 })"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          H1
        </button>

        <button
          data-text-btn="true"
          type="button"
          :data-active="editor.isActive('heading', { level: 2 })"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </button>

        <button
          data-text-btn="true"
          type="button"
          :data-active="editor.isActive('heading', { level: 3 })"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </button>

        <button
          data-text-btn="true"
          type="button"
          :data-active="editor.isActive('heading', { level: 4 })"
          @click="editor.chain().focus().toggleHeading({ level: 4 }).run()"
        >
          H4
        </button>

        <div data-divider></div>

        <button
          type="button"
          :data-active="editor.isActive('bulletList')"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <Icon name="lucide:list" />
        </button>

        <button
          type="button"
          :data-active="editor.isActive('orderedList')"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <Icon name="lucide:list-ordered" />
        </button>

        <div data-divider></div>

        <button
          v-if="enableImageUpload"
          type="button"
          :disabled="isUploading"
          @click="openImageSelector"
        >
          <Icon name="lucide:image" />
        </button>

        <button
          type="button"
          :data-active="editor.isActive('blockquote')"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <Icon name="lucide:quote" />
        </button>

        <button
          type="button"
          :data-active="editor.isActive('codeBlock')"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <Icon name="lucide:code" />
        </button>

        <button type="button" @click="editor.chain().focus().setHorizontalRule().run()">
          <Icon name="lucide:minus" />
        </button>

        <button type="button" @click="editor.chain().focus().setHardBreak().run()">
          <Icon name="lucide:corner-down-left" />
        </button>

        <div data-divider></div>

        <button
          type="button"
          :disabled="!editor.can().chain().focus().undo().run()"
          @click="editor.chain().focus().undo().run()"
        >
          <Icon name="lucide:undo-2" />
        </button>

        <button
          type="button"
          :disabled="!editor.can().chain().focus().redo().run()"
          @click="editor.chain().focus().redo().run()"
        >
          <Icon name="lucide:redo-2" />
        </button>

        <button
          type="button"
          :data-active="isEditingHtml"
          @click="toggleEditHtml"
        >
          <Icon name="lucide:code-2" />
        </button>

        <div v-if="isUploading" class="flex items-center">
          <div data-divider></div>
          <Icon class="animate-spin" name="lucide:loader-2" />
        </div>
      </div>

      <!-- Editor Content -->
      <div class="bg-white dark:bg-gray-900">
        <EditorContent :editor="editor" />
      </div>
    </div>

    <!-- Hidden file input for image selection -->
    <input
      ref="fileInput"
      multiple
      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
      class="hidden"
      type="file"
      @change="handleFileSelection"
    />
  </div>
</template>

<style scoped>
.toolbar button {
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: background-color 0.15s ease-in-out;
}

.toolbar button:hover:not(:disabled) {
  background-color: rgb(229 231 235);
}

.toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar button[data-active="true"] {
  background-color: rgb(219 234 254);
  color: rgb(37 99 235);
}

.toolbar button[data-text-btn="true"] {
  font-size: 0.875rem;
  font-weight: 600;
}

/* Icon styling */
.toolbar button :deep(svg) {
  width: 1rem;
  height: 1rem;
}

/* Divider styling */
.toolbar div[data-divider] {
  width: 1px;
  height: 1.5rem;
  background-color: rgb(209 213 219);
  margin: 0 0.25rem;
}

/* Dark mode styles */
@media (prefers-color-scheme: dark) {
  .toolbar button:hover:not(:disabled) {
    background-color: rgb(55 65 81);
  }

  .toolbar button[data-active="true"] {
    background-color: rgb(30 58 138);
    color: rgb(147 197 253);
  }

  .toolbar div[data-divider] {
    background-color: rgb(75 85 99);
  }
}
</style>
