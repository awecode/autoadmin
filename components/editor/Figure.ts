import { mergeAttributes, Node } from '@tiptap/core'
import { Fragment, DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

function findNodesInRange(doc: import('@tiptap/pm/model').Node, from: number, to: number, predicate: (node: import('@tiptap/pm/model').Node) => boolean): { node: import('@tiptap/pm/model').Node, pos: number }[] {
  const result: { node: import('@tiptap/pm/model').Node, pos: number }[] = []
  doc.descendants((node, pos) => {
    if (pos >= from && pos + node.nodeSize <= to && predicate(node))
      result.push({ node, pos })
  })
  return result
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      setFigure: (options: { src: string, alt?: string, title?: string, caption?: string }) => ReturnType
      imageToFigure: (options?: { caption?: string }) => ReturnType
      figureToImage: () => ReturnType
      updateFigureCaption: (caption: string) => ReturnType
    }
  }
}

export const Figure = Node.create({
  name: 'figure',

  group: 'block',

  content: 'inline*',

  draggable: true,

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('src'),
      },
      alt: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('alt') ?? '',
        renderHTML: attributes => ({ alt: attributes.alt ?? '' }),
      },
      title: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('title'),
      },
      width: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('width'),
      },
      height: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('height'),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getContent: (node, schema) => {
          const figcaption = (node as HTMLElement).querySelector('figcaption')
          if (!figcaption) {
            return Fragment.empty
          }
          return ProseMirrorDOMParser.fromSchema(schema).parseSlice(figcaption).content
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      this.options.HTMLAttributes,
      ['img', mergeAttributes(HTMLAttributes, { draggable: false, contenteditable: false })],
      ['figcaption', 0],
    ]
  },

  addNodeView() {
    return ({ editor, node, getPos }) => {
      const figure = document.createElement('figure')
      const img = document.createElement('img')
      img.setAttribute('draggable', 'false')
      img.setAttribute('contenteditable', 'false')
      if (node.attrs.src)
        img.setAttribute('src', node.attrs.src)
      img.setAttribute('alt', node.attrs.alt ?? '')
      if (node.attrs.title)
        img.setAttribute('title', node.attrs.title)
      if (node.attrs.width != null)
        img.setAttribute('width', String(node.attrs.width))
      if (node.attrs.height != null)
        img.setAttribute('height', String(node.attrs.height))
      const figcaption = document.createElement('figcaption')
      figure.appendChild(img)
      figure.appendChild(figcaption)
      figure.addEventListener('click', (e) => {
        if (e.target === img) {
          const pos = typeof getPos === 'function' ? getPos() : undefined
          if (typeof pos === 'number')
            editor.commands.setNodeSelection(pos)
          e.preventDefault()
        }
      })
      return {
        dom: figure,
        contentDOM: figcaption,
      }
    }
  },

  addCommands() {
    return {
      setFigure:
        ({ caption, ...attrs }) =>
          ({ chain }) => {
            return chain()
              .insertContent({
                type: this.name,
                attrs,
                content: caption ? [{ type: 'text', text: caption }] : [],
              })
              .focus()
              .run()
          },

      updateFigureCaption:
        caption =>
          ({ state, dispatch }) => {
            const { selection } = state
            let pos: number | undefined
            let node: import('@tiptap/pm/model').Node | null | undefined = state.doc.nodeAt(selection.from)
            if (selection instanceof NodeSelection && selection.node.type.name === 'figure') {
              pos = selection.from
              node = selection.node
            }
            else {
              const { $from } = selection
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === 'figure') {
                  pos = $from.before(d)
                  node = $from.node(d)
                  break
                }
              }
            }
            if (!node || node.type.name !== 'figure' || pos === undefined)
              return false
            const content = caption ? this.type.schema.text(caption) : null
            const newNode = node.type.create(node.attrs, content ? [content] : undefined, node.marks)
            if (dispatch)
              dispatch(state.tr.replaceWith(pos, pos + node.nodeSize, newNode))
            return true
          },

      imageToFigure:
        ({ caption } = {}) =>
          ({ state, dispatch }) => {
            const { doc, selection } = state
            const from = selection.from
            let to = selection.to
            if (from === to) {
              const node = doc.nodeAt(from)
              if (node && node.type.name === 'image') {
                to = from + node.nodeSize
              }
            }
            const images = findNodesInRange(doc, from, to, n => n.type.name === 'image')
            if (!images.length)
              return false
            const tr = state.tr
            const captionContent = caption?.trim()
            for (const { node, pos } of images.sort((a, b) => b.pos - a.pos)) {
              const content = captionContent
                ? [this.type.schema.text(captionContent)]
                : undefined
              tr.replaceWith(pos, pos + node.nodeSize, this.type.create({
                src: node.attrs.src,
                alt: node.attrs.alt,
                title: node.attrs.title,
                width: node.attrs.width,
                height: node.attrs.height,
              }, content))
            }
            if (dispatch)
              dispatch(tr)
            return true
          },

      figureToImage:
        () =>
          ({ state, dispatch }) => {
            const { doc, selection } = state
            const from = selection.from
            let to = selection.to
            if (from === to) {
              const node = doc.nodeAt(from)
              if (node && node.type.name === this.name) {
                to = from + node.nodeSize
              }
            }
            const figures = findNodesInRange(doc, from, to, n => n.type.name === this.name)
            if (!figures.length)
              return false
            const imageType = state.schema.nodes.image
            if (!imageType)
              return false
            const tr = state.tr
            for (const { node, pos } of figures.sort((a, b) => b.pos - a.pos)) {
              tr.replaceWith(pos, pos + node.nodeSize, imageType.create({
                src: node.attrs.src,
                alt: node.attrs.alt,
                title: node.attrs.title,
                width: node.attrs.width,
                height: node.attrs.height,
              }))
            }
            if (dispatch)
              dispatch(tr)
            return true
          },
    }
  },
})
