import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/core'
import { mergeAttributes, Node } from '@tiptap/core'

export const MediaText = Node.create({
  name: 'mediaText',
  group: 'block',
  content: '(image | figure) block+', // First child is image or figure, then one or more blocks
  defining: true,
  isolating: true, // Traps the cursor nicely

  addAttributes() {
    return {
      layout: { default: 'left' }, // 'left' or 'right'
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="media-text"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'media-text',
        'class': `media-text-${HTMLAttributes.layout}`, // Drives the CSS Grid
      }),
      0, // The real Tiptap image node and text nodes are rendered here
    ]
  },
})

export function mediaTextToolbarItems(editor: Editor): EditorToolbarItem[][] {
  return [[{
    icon: 'i-lucide-arrow-left-right',
    tooltip: { text: 'Swap Layout' },
    onClick: () => {
      const currentLayout = editor.getAttributes('mediaText').layout
      const newLayout = currentLayout === 'image-left' ? 'image-right' : 'image-left'
      editor.chain().focus().updateAttributes('mediaText', { layout: newLayout }).run()
    },
  }, {
    // This allows the user to break the block back into a normal image and text,
    // so they can use your standard image replacement/upload tools!
    icon: 'i-lucide-ungroup',
    tooltip: { text: 'Revert to Standard Image' },
    onClick: () => {
      const { state } = editor
      const $from = state.selection.$from

      let mediaTextNode = null
      let mediaTextPos = -1

      for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth)
        if (node.type.name === 'mediaText') {
          mediaTextNode = node
          mediaTextPos = $from.before(depth)
          break
        }
      }

      if (mediaTextNode) {
        const firstChild = mediaTextNode.firstChild
        const content = mediaTextNode.content
        if (firstChild) {
          const restFragment = content.cut(firstChild.nodeSize, content.size)
          const insertContent = [firstChild.toJSON(), ...restFragment.toJSON()]
          editor.chain().focus().deleteRange({ from: mediaTextPos, to: mediaTextPos + mediaTextNode.nodeSize }).insertContentAt(mediaTextPos, insertContent).run()
        }
      }
    },
  }], [{
    icon: 'i-lucide-arrow-up-to-line',
    tooltip: { text: 'Insert Above' },
    onClick: () => {
      const { state } = editor
      const $from = state.selection.$from
      // Find the start position of the mediaText block to insert before it
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === 'mediaText') {
          editor.chain().focus().insertContentAt($from.before(depth), { type: 'paragraph' }).run()
          break
        }
      }
    },
  }, {
    icon: 'i-lucide-arrow-down-to-line',
    tooltip: { text: 'Insert Below' },
    onClick: () => {
      const { state } = editor
      const $from = state.selection.$from
      // Find the end position of the mediaText block to insert after it
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === 'mediaText') {
          editor.chain().focus().insertContentAt($from.after(depth), { type: 'paragraph' }).run()
          break
        }
      }
    },
  }], [{
    icon: 'i-lucide-trash',
    tooltip: { text: 'Delete Block' },
    onClick: () => {
      editor.chain().focus().deleteNode('mediaText').run()
    },
  }]]
}
