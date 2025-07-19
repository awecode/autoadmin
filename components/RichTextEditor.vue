<script setup lang="ts">
import { ListItem } from '@tiptap/extension-list'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'

const props = defineProps<{
  modelValue?: string
  attrs?: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  content: props.modelValue || '',
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none dark:prose-invert min-h-[200px] p-4',
    },
  },
  extensions: [
    Color.configure({ types: [TextStyle.name, ListItem.name] }),
    TextStyle,
    StarterKit,
  ],
  onUpdate: ({ editor: editorInstance }) => {
    emit('update:modelValue', editorInstance.getHTML())
  },
})

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
          <Icon name="lucide:code-2" />
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
      </div>

      <!-- Editor Content -->
      <div class="bg-white dark:bg-gray-900">
        <EditorContent :editor="editor" />
      </div>
    </div>
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
