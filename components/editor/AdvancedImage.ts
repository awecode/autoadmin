import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/core'
import type { ImageFloat } from './imageFloat'
import Image from '@tiptap/extension-image'
import { imageFloatAttribute, isInsideMediaText } from './imageFloat'

export { isInsideMediaText }

export const AdvancedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: '',
        parseHTML: element => element.getAttribute('alt') ?? '',
        renderHTML: attributes => ({ alt: attributes.alt ?? '' }),
      },
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: (attributes) => {
          if (attributes.width == null)
            return {}
          return { width: String(attributes.width) }
        },
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: (attributes) => {
          if (attributes.height == null)
            return {}
          return { height: String(attributes.height) }
        },
      },
      float: imageFloatAttribute,
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

function getFloatFromSelection(editor: Editor): ImageFloat {
  const sel = getSelectedImageOrFigure(editor)
  if (!sel)
    return 'none'
  return (sel.node.attrs.float as ImageFloat | undefined) ?? 'none'
}

function setFloatOnSelection(editor: Editor, float: ImageFloat) {
  const sel = getSelectedImageOrFigure(editor)
  if (!sel)
    return
  const type = sel.node.type.name
  editor.chain().focus().updateAttributes(type, { float }).run()
}

function wrapInMediaText(editor: Editor, layout: 'left' | 'right') {
  const { state } = editor
  const pos = state.selection.from
  const node = state.doc.nodeAt(pos)
  if (!node || (node.type.name !== 'image' && node.type.name !== 'figure'))
    return

  const attrs = { ...node.attrs, float: 'none' }
  const firstChild = node.type.name === 'image'
    ? { type: 'image' as const, attrs }
    : { type: 'figure' as const, attrs, content: node.content.toJSON() }

  editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).insertContentAt(pos, {
    type: 'mediaText',
    attrs: { layout },
    content: [
      firstChild,
      { type: 'paragraph' },
    ],
  }).run()
}

export function imageToolbarItems(editor: Editor): EditorToolbarItem[][] {
  const selected = getSelectedImageOrFigure(editor)
  const isFigure = selected?.node.type.name === 'figure'
  const insideMediaText = isInsideMediaText(editor)
  const currentFloat = getFloatFromSelection(editor)

  const actionItems: EditorToolbarItem[] = [
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
              throw new Error(response.statusText || 'Failed to download image')
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)
            const fileName = imageUrl.split('/').pop()?.split('?')[0] || 'downloaded-image'
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
  ]

  const deleteItems: EditorToolbarItem[] = [{
    icon: 'i-lucide-trash',
    tooltip: { text: 'Delete' },
    onClick: () => {
      const sel = getSelectedImageOrFigure(editor)
      if (sel)
        editor.chain().focus().deleteRange({ from: sel.pos, to: sel.pos + sel.node.nodeSize }).run()
    },
  }]

  if (insideMediaText) {
    return [actionItems, deleteItems]
  }

  const floatItems: EditorToolbarItem[] = [{
    icon: 'i-lucide-align-left',
    tooltip: { text: 'Float left' },
    active: currentFloat === 'left',
    onClick: () => setFloatOnSelection(editor, 'left'),
  }, {
    icon: 'i-lucide-wrap-text',
    tooltip: { text: 'Block image' },
    active: currentFloat === 'none',
    onClick: () => setFloatOnSelection(editor, 'none'),
  }, {
    icon: 'i-lucide-align-right',
    tooltip: { text: 'Float right' },
    active: currentFloat === 'right',
    onClick: () => setFloatOnSelection(editor, 'right'),
  }]

  const mediaBlockItems: EditorToolbarItem[] = [{
    icon: 'i-lucide-panel-left',
    tooltip: { text: 'Side by side (media left)' },
    onClick: () => wrapInMediaText(editor, 'left'),
  }, {
    icon: 'i-lucide-panel-right',
    tooltip: { text: 'Side by side (media right)' },
    onClick: () => wrapInMediaText(editor, 'right'),
  }]

  return [actionItems, deleteItems, floatItems, mediaBlockItems]
}
