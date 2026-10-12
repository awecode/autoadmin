import { Node } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { loadTwitterWidgets, tweetStatusUrl } from './twitterEmbed'

export const defaultEmbedTypes = ['youtube', 'facebook', 'linkedin', 'pdf', 'video', 'audio', 'iframe'] as const

export type EmbedType = typeof defaultEmbedTypes[number] | 'twitter'

const MEDIA_TYPES = new Set<EmbedType>(['video', 'audio'])

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attrs: { embedType: EmbedType, src: string, width?: number | null, height?: number | null }) => ReturnType
    }
  }
}

function normalizeDim(value: string | number | null) {
  if (!value)
    return null
  const trimmed = value.toString().trim()
  if (!trimmed)
    return null
  if (/^\d+(?:\.\d+)?$/.test(trimmed) && !trimmed.endsWith('%'))
    return `${trimmed}px`
  return trimmed
}

export const Embed = Node.create({
  name: 'embed',

  addOptions() {
    return {
      twitter: false,
    }
  },

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
          const tweetHref = el.querySelector('blockquote.twitter-tweet a')?.getAttribute('href') ?? null
          return {
            embedType,
            src: media?.getAttribute('src') ?? tweetHref,
            width: media?.getAttribute('width') ?? null,
            height: media?.getAttribute('height') ?? null,
          }
        },
      },
      {
        tag: 'iframe',
        getAttrs: (element) => {
          const el = element as HTMLIFrameElement
          const src = el.getAttribute('src')
          let embedType: EmbedType = 'iframe'

          const tweetUrl = this.options.twitter && src ? tweetStatusUrl(src) : null
          if (tweetUrl) {
            embedType = 'twitter'
          }
          else if (src?.includes('youtube.com') || src?.includes('youtu.be')) {
            embedType = 'youtube'
          }
          else if (src?.includes('facebook.com')) {
            embedType = 'facebook'
          }

          return {
            embedType,
            src: tweetUrl || src,
            width: el.getAttribute('width') ?? null,
            height: el.getAttribute('height') ?? null,
          }
        },
      },
      ...(this.options.twitter
        ? [{
            tag: 'blockquote.twitter-tweet',
            priority: 100,
            getAttrs: (element: HTMLElement) => {
              const url = tweetStatusUrl(element.outerHTML)
              if (!url)
                return false
              return {
                embedType: 'twitter' as const,
                src: url,
                width: null,
                height: null,
              }
            },
          }]
        : []),
      {
        tag: 'video',
        getAttrs: (element) => {
          const el = element as HTMLVideoElement
          return {
            embedType: 'video',
            src: el.getAttribute('src') ?? null,
            width: el.getAttribute('width') ?? null,
            height: el.getAttribute('height') ?? null,
          }
        },
      },
      {
        tag: 'audio',
        getAttrs: (element) => {
          const el = element as HTMLAudioElement
          return {
            embedType: 'audio',
            src: el.getAttribute('src') ?? null,
            width: null,
            height: null,
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

    if (embedType === 'twitter') {
      const quote = ['blockquote', { class: 'twitter-tweet' }]
      if (!src)
        return ['div', wrapperAttrs, quote]
      return ['div', wrapperAttrs, ['blockquote', { class: 'twitter-tweet' }, ['a', { href: src }, src]]]
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

      if (embedType === 'twitter') {
        const preview = document.createElement('div')
        preview.style.pointerEvents = 'none'
        const quote = document.createElement('blockquote')
        quote.className = 'twitter-tweet'
        if (node.attrs.src) {
          const link = document.createElement('a')
          link.href = node.attrs.src
          link.textContent = node.attrs.src
          quote.appendChild(link)
        }
        preview.appendChild(quote)
        container.appendChild(preview)

        loadTwitterWidgets()
          .then(twttr => twttr.widgets?.load(preview))
          .catch(() => {})

        container.addEventListener('dblclick', (event) => {
          preview.style.pointerEvents = 'auto'
          event.stopPropagation()
        })

        container.addEventListener('click', (event) => {
          const pos = typeof getPos === 'function' ? getPos() : undefined
          if (typeof pos === 'number') {
            editor.commands.setNodeSelection(pos)
            event.preventDefault()
            event.stopPropagation()
          }
        })

        const onSelectionUpdate = () => {
          const { selection } = editor.state
          const pos = typeof getPos === 'function' ? getPos() : undefined
          if (typeof pos !== 'number')
            return
          if (selection instanceof NodeSelection && selection.from === pos)
            return
          preview.style.pointerEvents = 'none'
        }

        editor.on('selectionUpdate', onSelectionUpdate)

        return {
          dom: container,
          destroy() {
            editor.off('selectionUpdate', onSelectionUpdate)
          },
        }
      }

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
