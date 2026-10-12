const STATUS_URL = /https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/(?:i\/web\/status\/(\d+)|(\w{1,15})\/status\/(\d+))/i
const EMBED_ID = /https?:\/\/platform\.(?:twitter|x)\.com\/embed\/Tweet\.html\?[^#\s'"]*\bid=(\d+)/i

const TWITTER_WIDGETS_SRC = 'https://platform.x.com/widgets.js'
const TWITTER_SCRIPT_ID = 'twitter-wjs'

interface TwitterWidgetsApi {
  ready: (fn: (twttr: TwitterWidgetsApi) => void) => void
  widgets?: {
    load: (el?: HTMLElement) => void
  }
  _e?: Array<(twttr: TwitterWidgetsApi) => void>
}

/** Canonical post URL from a link or from X's embed code. */
export function tweetStatusUrl(input: string): string | null {
  const embedId = input.match(EMBED_ID)
  if (embedId?.[1])
    return `https://x.com/i/web/status/${embedId[1]}`

  const match = input.match(STATUS_URL)
  if (!match)
    return null
  if (match[1])
    return `https://x.com/i/web/status/${match[1]}`
  if (match[2] && match[3])
    return `https://x.com/${match[2]}/status/${match[3]}`
  return null
}

export function loadTwitterWidgets(): Promise<TwitterWidgetsApi> {
  const w = window as Window & { twttr?: TwitterWidgetsApi }
  if (w.twttr?.widgets)
    return Promise.resolve(w.twttr)

  if (!w.twttr) {
    const stub: TwitterWidgetsApi = {
      _e: [],
      ready(fn) {
        stub._e?.push(fn)
      },
    }
    w.twttr = stub
  }

  if (!document.getElementById(TWITTER_SCRIPT_ID)) {
    const script = document.createElement('script')
    script.id = TWITTER_SCRIPT_ID
    script.async = true
    script.src = TWITTER_WIDGETS_SRC
    script.charset = 'utf-8'
    document.head.appendChild(script)
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('X widgets did not load')), 20000)
    w.twttr?.ready((twttr) => {
      window.clearTimeout(timer)
      if (twttr.widgets)
        resolve(twttr)
      else
        reject(new Error('X widgets missing'))
    })
  })
}
