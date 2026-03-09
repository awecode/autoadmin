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
    const width = HTMLAttributes.width
    const height = HTMLAttributes.height

    const iframeAttrs: Record<string, string> = {}
    if (src)
      iframeAttrs.src = src
    if (width != null)
      iframeAttrs.width = String(width)
    if (height != null)
      iframeAttrs.height = String(height)

    iframeAttrs.frameborder = '0'

    if (embedType === 'youtube') {
      iframeAttrs.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      iframeAttrs.allowfullscreen = 'true'
    }

    return [
      'div',
      {
        'data-type': 'embed',
        'data-embed-type': embedType,
        class: 'embed-node',
      },
      ['iframe', iframeAttrs],
    ]
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

