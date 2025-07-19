<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
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
      class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none',
    },
  },
  extensions: [
    Color.configure({ types: [TextStyle.name, ListItem.name] }),
    TextStyle.configure({ types: [ListItem.name] }),
    StarterKit,
  ],
  onUpdate: ({ editor: editorInstance }: { editor: Editor }) => {
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
    <div v-if="editor" class="container">
      <div class="control-group">
        <div class="span-group">
          <span
            :class="{ 'is-active': editor.isActive('bold') }"
            :disabled="!editor.can().chain().focus().toggleBold().run()"
            @click="editor.chain().focus().toggleBold().run()"
          >
            Bold
          </span>
          <span
            :class="{ 'is-active': editor.isActive('italic') }"
            :disabled="!editor.can().chain().focus().toggleItalic().run()"
            @click="editor.chain().focus().toggleItalic().run()"
          >
            Italic
          </span>
          <span
            :class="{ 'is-active': editor.isActive('strike') }"
            :disabled="!editor.can().chain().focus().toggleStrike().run()"
            @click="editor.chain().focus().toggleStrike().run()"
          >
            Strike
          </span>
          <span
            :class="{ 'is-active': editor.isActive('code') }"
            :disabled="!editor.can().chain().focus().toggleCode().run()"
            @click="editor.chain().focus().toggleCode().run()"
          >
            Code
          </span>
          <span @click="editor.chain().focus().unsetAllMarks().run()">
            Clear marks
          </span>
          <span @click="editor.chain().focus().clearNodes().run()">
            Clear nodes
          </span>
          <span
            :class="{ 'is-active': editor.isActive('paragraph') }"
            @click="editor.chain().focus().setParagraph().run()"
          >
            Paragraph
          </span>
          <span
            :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
            @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
          >
            H1
          </span>
          <span
            :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
            @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          >
            H2
          </span>
          <span
            :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
            @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          >
            H3
          </span>
          <span
            :class="{ 'is-active': editor.isActive('heading', { level: 4 }) }"
            @click="editor.chain().focus().toggleHeading({ level: 4 }).run()"
          >
            H4
          </span>
          <span
            :class="{ 'is-active': editor.isActive('heading', { level: 5 }) }"
            @click="editor.chain().focus().toggleHeading({ level: 5 }).run()"
          >
            H5
          </span>
          <span
            :class="{ 'is-active': editor.isActive('heading', { level: 6 }) }"
            @click="editor.chain().focus().toggleHeading({ level: 6 }).run()"
          >
            H6
          </span>
          <span
            :class="{ 'is-active': editor.isActive('bulletList') }"
            @click="editor.chain().focus().toggleBulletList().run()"
          >
            Bullet list
          </span>
          <span
            :class="{ 'is-active': editor.isActive('orderedList') }"
            @click="editor.chain().focus().toggleOrderedList().run()"
          >
            Ordered list
          </span>
          <span
            :class="{ 'is-active': editor.isActive('codeBlock') }"
            @click="editor.chain().focus().toggleCodeBlock().run()"
          >
            Code block
          </span>
          <span
            :class="{ 'is-active': editor.isActive('blockquote') }"
            @click="editor.chain().focus().toggleBlockquote().run()"
          >
            Blockquote
          </span>
          <span @click="editor.chain().focus().setHorizontalRule().run()">
            Horizontal rule
          </span>
          <span @click="editor.chain().focus().setHardBreak().run()">
            Hard break
          </span>
          <span :disabled="!editor.can().chain().focus().undo().run()" @click="editor.chain().focus().undo().run()">
            Undo
          </span>
          <span :disabled="!editor.can().chain().focus().redo().run()" @click="editor.chain().focus().redo().run()">
            Redo
          </span>
          <span
            :class="{ 'is-active': editor.isActive('textStyle', { color: '#958DF1' }) }"
            @click="editor.chain().focus().setColor('#958DF1').run()"
          >
            Purple
          </span>
        </div>
      </div>
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<style>
/* Basic editor styles */
.tiptap:first-child {
  margin-top: 0;
}

/* List styles */
.tiptap ul,
.tiptap ol {
  padding: 0 1rem;
  margin: 1.25rem 1rem 1.25rem 0.4rem;
}

.tiptap ul li p,
.tiptap ol li p {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

/* Heading styles */
.tiptap h1,
.tiptap h2,
.tiptap h3,
.tiptap h4,
.tiptap h5,
.tiptap h6 {
  line-height: 1.1;
  margin-top: 2.5rem;
  text-wrap: pretty;
}

.tiptap h1,
.tiptap h2 {
  margin-top: 3.5rem;
  margin-bottom: 1.5rem;
}

.tiptap h1 {
  font-size: 1.4rem;
}

.tiptap h2 {
  font-size: 1.2rem;
}

.tiptap h3 {
  font-size: 1.1rem;
}

.tiptap h4,
.tiptap h5,
.tiptap h6 {
  font-size: 1rem;
}

/* Code and preformatted text styles */
.tiptap code {
  background-color: var(--purple-light);
  border-radius: 0.4rem;
  color: var(--black);
  font-size: 0.85rem;
  padding: 0.25em 0.3em;
}

.tiptap pre {
  background: var(--black);
  border-radius: 0.5rem;
  color: var(--white);
  font-family: 'JetBrainsMono', monospace;
  margin: 1.5rem 0;
  padding: 0.75rem 1rem;
}

.tiptap pre code {
  background: none;
  color: inherit;
  font-size: 0.8rem;
  padding: 0;
}

.tiptap blockquote {
  border-left: 3px solid var(--gray-3);
  margin: 1.5rem 0;
  padding-left: 1rem;
}

.tiptap hr {
  border: none;
  border-top: 1px solid var(--gray-2);
  margin: 2rem 0;
}
</style>
