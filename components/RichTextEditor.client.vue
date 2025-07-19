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
  <div v-bind="attrs">
    <div v-if="editor" class="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      <!-- Toolbar -->
      <div class="flex flex-wrap gap-1 p-3 border-b bg-gray-50 dark:bg-gray-800">
        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('bold') }"
          :disabled="!editor.can().chain().focus().toggleBold().run()"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Icon class="w-4 h-4" name="lucide:bold" />
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('italic') }"
          :disabled="!editor.can().chain().focus().toggleItalic().run()"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Icon class="w-4 h-4" name="lucide:italic" />
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('strike') }"
          :disabled="!editor.can().chain().focus().toggleStrike().run()"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <Icon class="w-4 h-4" name="lucide:strikethrough" />
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('code') }"
          :disabled="!editor.can().chain().focus().toggleCode().run()"
          @click="editor.chain().focus().toggleCode().run()"
        >
          <Icon class="w-4 h-4" name="lucide:code" />
        </button>

        <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('heading', { level: 1 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          H1
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('heading', { level: 2 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('heading', { level: 3 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </button>

        <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('bulletList') }"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <Icon class="w-4 h-4" name="lucide:list" />
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('orderedList') }"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <Icon class="w-4 h-4" name="lucide:list-ordered" />
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('blockquote') }"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <Icon class="w-4 h-4" name="lucide:quote" />
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          type="button"
          :class="{ 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': editor.isActive('codeBlock') }"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <Icon class="w-4 h-4" name="lucide:code-2" />
        </button>

        <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          type="button"
          :disabled="!editor.can().chain().focus().undo().run()"
          @click="editor.chain().focus().undo().run()"
        >
          <Icon class="w-4 h-4" name="lucide:undo-2" />
        </button>

        <button
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          type="button"
          :disabled="!editor.can().chain().focus().redo().run()"
          @click="editor.chain().focus().redo().run()"
        >
          <Icon class="w-4 h-4" name="lucide:redo-2" />
        </button>
      </div>

      <!-- Editor Content -->
      <div class="bg-white dark:bg-gray-900">
        <EditorContent :editor="editor" />
      </div>
    </div>
  </div>
</template>

<style>

</style>
