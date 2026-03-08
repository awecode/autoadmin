import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'
import Image from '@tiptap/extension-image'

export const AdvancedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      float: {
        default: null,
        parseHTML: element => element.style.float,
        renderHTML: (attributes) => {
          if (!attributes.float)
            return {}
          const marginSide = attributes.float === 'left' ? 'right' : 'left'
          return { style: `float: ${attributes.float}; margin-${marginSide}: 1.5rem; margin-bottom: 1.5rem;` }
        },
      },
    }
  },
})

function getSelectedImageOrFigure(editor: Editor) {
  const pos = editor.state.selection.from
  const node = editor.state.doc.nodeAt(pos)
  if (node && (node.type.name === 'image' || node.type.name === 'figure'))
    return { node, pos }
  return null
}

export function imageToolbarItems(editor: Editor): EditorToolbarItem[][] {
  const selected = getSelectedImageOrFigure(editor)
  const isFigure = selected?.node.type.name === 'figure'

  return [[
    ...(selected
      ? [{
          icon: isFigure ? 'i-lucide-captions-off' : 'i-lucide-captions',
          tooltip: { text: isFigure ? 'Remove caption' : 'Add caption' },
          onClick: () => {
            if (isFigure)
              editor.chain().focus().figureToImage().run()
            else
              editor.chain().focus().imageToFigure().run()
          },
        }]
      : []),
    {
      icon: 'i-lucide-download',
      tooltip: { text: 'Download' },
      onClick: async () => {
        const sel = getSelectedImageOrFigure(editor)
        if (sel) {
          const imageUrl = sel.node.attrs.src
          try {
            const response = await fetch(imageUrl)
            if (!response.ok)
              throw new Error('Network response was not ok')
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)
            const fileName = imageUrl.split('/').pop().split('?')[0] || 'downloaded-image'
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(blobUrl)
          }
          catch (error) {
            console.error('Failed to download image:', error)
            window.open(imageUrl, '_blank')
          }
        }
      },
    },
    {
      icon: 'i-lucide-refresh-cw',
      tooltip: { text: 'Replace' },
      onClick: () => {
        const sel = getSelectedImageOrFigure(editor)
        if (sel)
          editor.chain().focus().deleteRange({ from: sel.pos, to: sel.pos + sel.node.nodeSize }).insertContentAt(sel.pos, { type: 'imageUpload' }).run()
      },
    },
  ], [{
    icon: 'i-lucide-trash',
    tooltip: { text: 'Delete' },
    onClick: () => {
      const sel = getSelectedImageOrFigure(editor)
      if (sel)
        editor.chain().focus().deleteRange({ from: sel.pos, to: sel.pos + sel.node.nodeSize }).run()
    },
  }], [{
    icon: 'i-lucide-panel-left',
    tooltip: { text: 'Image Left, Text Right' },
    active: editor.isActive('mediaText', { layout: 'left' }),
    onClick: () => {
      const { state } = editor
      const pos = state.selection.from

      if (editor.isActive('mediaText')) {
        // If already in a MediaText block, just update the direction
        editor.chain().focus().updateAttributes('mediaText', { layout: 'left' }).run()
      }
      else {
        // Wrap selected image or figure in a new MediaText block
        const node = state.doc.nodeAt(pos)
        if (node && (node.type.name === 'image' || node.type.name === 'figure')) {
          const firstChild = node.type.name === 'image'
            ? { type: 'image' as const, attrs: node.attrs }
            : { type: 'figure' as const, attrs: node.attrs, content: node.content.toJSON() }
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).insertContentAt(pos, {
            type: 'mediaText',
            attrs: { layout: 'left' },
            content: [
              firstChild,
              { type: 'paragraph' },
            ],
          }).run()
        }
      }
    },
  }, {
    icon: 'i-lucide-panel-top',
    tooltip: { text: 'Standard Image (Unwrap)' },
    active: !editor.isActive('mediaText'),
    onClick: () => {
      if (editor.isActive('mediaText')) {
        const { state } = editor
        const $from = state.selection.$from
        let blockNode = null
        let blockPos = -1

        // Find the parent MediaText boundary
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'mediaText') {
            blockNode = $from.node(depth)
            blockPos = $from.before(depth)
            break
          }
        }

        if (blockNode) {
          // Extract the true image and text, delete the wrapper block, and drop them back
          editor.chain().focus().deleteRange({ from: blockPos, to: blockPos + blockNode.nodeSize }).insertContentAt(blockPos, blockNode.content.toJSON()).run()
        }
      }
    },
  }, {
    icon: 'i-lucide-panel-right',
    tooltip: { text: 'Image Right, Text Left' },
    active: editor.isActive('mediaText', { layout: 'right' }),
    onClick: () => {
      const { state } = editor
      const pos = state.selection.from

      if (editor.isActive('mediaText')) {
        editor.chain().focus().updateAttributes('mediaText', { layout: 'right' }).run()
      }
      else {
        const node = state.doc.nodeAt(pos)
        if (node && (node.type.name === 'image' || node.type.name === 'figure')) {
          const firstChild = node.type.name === 'image'
            ? { type: 'image' as const, attrs: node.attrs }
            : { type: 'figure' as const, attrs: node.attrs, content: node.content.toJSON() }
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).insertContentAt(pos, {
            type: 'mediaText',
            attrs: { layout: 'right' },
            content: [
              firstChild,
              { type: 'paragraph' },
            ],
          }).run()
        }
      }
    },
  }]]
}
