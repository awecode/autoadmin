<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit'
import { useEditor, EditorContent, Editor } from '@tiptap/vue-3'

const props = defineProps<{
  modelValue?: string
  attrs?: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [StarterKit],
  onUpdate: ({ editor: editorInstance }: { editor: Editor }) => {
    emit('update:modelValue', editorInstance.getHTML())
  }
})

watch(() => props.modelValue, (value) => {
  const isSame = editor.value.getHTML() === value
  if (isSame) return
  editor.value.commands.setContent(value)
})
</script>

<template>
  <div v-bind="attrs">
    <editor-content :editor="editor" />
  </div>
</template>
