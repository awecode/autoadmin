import { Node } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

export type EmbedType = 'youtube' | 'iframe' | 'facebook' | 'linkedin' | 'pdf' | 'video' | 'audio'

const MEDIA_TYPES = new Set<EmbedType>(['video', 'audio'])

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attrs: { embedType: EmbedType, src: string, width?: number | null, height?: number | null }) => ReturnType
    }
  }
}

function normalizeDim(value: string | null) {
  if (!value)
    return null
  const trimmed = value.trim()
  if (!trimmed)
    return null
  if (/^\d+(?:\.\d+)?$/.test(trimmed) && !trimmed.endsWith('%'))
    return `${trimmed}px`
  return trimmed
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
    return [
      {
        tag: 'div[data-type="embed"]',
        getAttrs: (element) => {
          const el = element as HTMLElement
          const embedType = (el.getAttribute('data-embed-type') ?? 'iframe') as EmbedType
          const media = el.querySelector('video, audio, iframe')
          return {
            embedType,
            src: media?.getAttribute('src') ?? null,
            width: media?.getAttribute('width') ?? null,
            height: media?.getAttribute('height') ?? null,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const embedType = (HTMLAttributes.embedType as EmbedType) ?? 'iframe'
    const src = HTMLAttributes.src as string | null
    const widthAttr = HTMLAttributes.width as string | null
    const heightAttr = HTMLAttributes.height as string | null

    const wrapperAttrs: Record<string, string> = {
      'data-type': 'embed',
      'data-embed-type': embedType,
      'class': 'embed-node',
    }

    const normWidth = normalizeDim(widthAttr)
    const normHeight = normalizeDim(heightAttr)

    if (normWidth)
      wrapperAttrs.style = `width:${normWidth};`

    if (embedType === 'video') {
      const videoAttrs: Record<string, string> = { controls: 'true' }
      if (src)
        videoAttrs.src = src
      if (normHeight)
        videoAttrs.style = `height:${normHeight};`
      return ['div', wrapperAttrs, ['video', videoAttrs]]
    }

    if (embedType === 'audio') {
      const audioAttrs: Record<string, string> = { controls: 'true' }
      if (src)
        audioAttrs.src = src
      return ['div', wrapperAttrs, ['audio', audioAttrs]]
    }

    const iframeAttrs: Record<string, string> = { frameborder: '0' }
    if (src)
      iframeAttrs.src = src
    if (embedType === 'youtube') {
      iframeAttrs.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      iframeAttrs.allowfullscreen = 'true'
    }
    if (normHeight)
      iframeAttrs.style = `height:${normHeight};`

    return ['div', wrapperAttrs, ['iframe', iframeAttrs]]
  },

  addNodeView() {
    return ({ editor, node, getPos }) => {
      const embedType = (node.attrs.embedType as EmbedType) ?? 'iframe'
      const container = document.createElement('div')
      container.classList.add('embed-node')
      container.setAttribute('data-type', 'embed')
      container.setAttribute('data-embed-type', embedType)

      const widthAttr = node.attrs.width as string | null
      const heightAttr = node.attrs.height as string | null
      const normWidth = normalizeDim(widthAttr)
      const normHeight = normalizeDim(heightAttr)

      if (normWidth)
        container.style.width = normWidth

      let child: HTMLElement

      if (MEDIA_TYPES.has(embedType)) {
        const media = document.createElement(embedType === 'audio' ? 'audio' : 'video')
        media.controls = true
        media.setAttribute('contenteditable', 'false')
        if (node.attrs.src)
          media.setAttribute('src', node.attrs.src)
        if (normHeight && embedType === 'video')
          media.style.height = normHeight
        media.style.display = 'block'
        media.style.maxWidth = '100%'
        child = media
      }
      else {
        const iframe = document.createElement('iframe')
        iframe.setAttribute('frameborder', '0')
        iframe.setAttribute('contenteditable', 'false')
        iframe.setAttribute('tabindex', '-1')
        iframe.style.display = 'block'
        iframe.style.pointerEvents = 'none'
        if (normHeight)
          iframe.style.height = normHeight
        if (node.attrs.src)
          iframe.setAttribute('src', node.attrs.src)
        child = iframe

        container.addEventListener('dblclick', (event) => {
          iframe.style.pointerEvents = 'auto'
          event.stopPropagation()
        })
      }

      container.appendChild(child)

      container.addEventListener('click', (event) => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (typeof pos === 'number') {
          editor.commands.setNodeSelection(pos)
          event.preventDefault()
          event.stopPropagation()
        }
      })

      const onSelectionUpdate = () => {
        const { state } = editor
        const { selection } = state
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (typeof pos !== 'number')
          return
        if (selection instanceof NodeSelection && selection.from === pos)
          return
        if (child instanceof HTMLIFrameElement)
          child.style.pointerEvents = 'none'
      }

      editor.on('selectionUpdate', onSelectionUpdate)

      return {
        dom: container,
        destroy() {
          editor.off('selectionUpdate', onSelectionUpdate)
        },
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
