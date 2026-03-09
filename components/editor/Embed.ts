import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attrs: { embedType: 'youtube' | 'iframe', src: string, width?: number | null, height?: number | null }) => ReturnType
    }
  }
}

export const Embed = Node.create({
  name: 'embed',

  group: 'block',

  atom: true,

  draggable: true,

  selectable: true,

  addAttributes() {
    return {
      embedType: {
        default: 'iframe',
      },
      src: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-type="embed"]',
      getAttrs: element => {
        const el = element as HTMLElement
        const iframe = el.querySelector('iframe')
        return {
          embedType: el.getAttribute('data-embed-type') ?? 'iframe',
          src: iframe?.getAttribute('src') ?? null,
          width: iframe?.getAttribute('width') ?? null,
          height: iframe?.getAttribute('height') ?? null,
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const embedType = (HTMLAttributes.embedType as 'youtube' | 'iframe') ?? 'iframe'
    const src = HTMLAttributes.src as string | null
    const widthAttr = HTMLAttributes.width as string | null
    const heightAttr = HTMLAttributes.height as string | null

    const iframeAttrs: Record<string, string> = {}
    if (src)
      iframeAttrs.src = src
    iframeAttrs.frameborder = '0'

    if (embedType === 'youtube') {
      iframeAttrs.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      iframeAttrs.allowfullscreen = 'true'
    }

    const wrapperAttrs: Record<string, string> = {
      'data-type': 'embed',
      'data-embed-type': embedType,
      class: 'embed-node',
    }

    let wrapperStyle = ''
    let iframeStyle = ''
    const normalizeDim = (value: string | null) => {
      if (!value)
        return null
      const trimmed = value.trim()
      if (!trimmed)
        return null
      // If it's purely numeric and doesn't end with %, treat as px
      if (/^\d+(\.\d+)?$/.test(trimmed) && !trimmed.endsWith('%'))
        return `${trimmed}px`
      return trimmed
    }

    const normWidth = normalizeDim(widthAttr)
    const normHeight = normalizeDim(heightAttr)

    if (normWidth)
      wrapperStyle += `width:${normWidth};`
    if (normHeight)
      iframeStyle += `height:${normHeight};`

    if (wrapperStyle)
      wrapperAttrs.style = wrapperStyle
    if (iframeStyle)
      iframeAttrs.style = iframeStyle

    return [
      'div',
      wrapperAttrs,
      ['iframe', iframeAttrs],
    ]
  },

  addNodeView() {
    return ({ editor, node, getPos }) => {
      const container = document.createElement('div')
      container.classList.add('embed-node')

      const normalizeDim = (value: string | null) => {
        if (!value)
          return null
        const trimmed = value.trim()
        if (!trimmed)
          return null
        if (/^\d+(\.\d+)?$/.test(trimmed) && !trimmed.endsWith('%'))
          return `${trimmed}px`
        return trimmed
      }

      const iframe = document.createElement('iframe')
      iframe.setAttribute('frameborder', '0')
      iframe.setAttribute('contenteditable', 'false')
      iframe.setAttribute('tabindex', '-1')
      iframe.style.display = 'block'

      const widthAttr = node.attrs.width as string | null
      const heightAttr = node.attrs.height as string | null
      const normWidth = normalizeDim(widthAttr)
      const normHeight = normalizeDim(heightAttr)

      if (normWidth)
        container.style.width = normWidth
      if (normHeight)
        iframe.style.height = normHeight

      if (node.attrs.src)
        iframe.setAttribute('src', node.attrs.src)

      container.appendChild(iframe)

      container.addEventListener('click', (event) => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (typeof pos === 'number') {
          editor.commands.setNodeSelection(pos)
          event.preventDefault()
          event.stopPropagation()
        }
      })

      return {
        dom: container,
      }
    }
  },

  addCommands() {
    return {
      setEmbed:
        attrs =>
          ({ chain }) =>
            chain().insertContent({
              type: this.name,
              attrs,
            }).run(),
    }
  },
})

