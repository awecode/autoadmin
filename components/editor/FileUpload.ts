import type { Editor } from '@tiptap/vue-3'

function getImageDimensions(src: string): Promise<{ width: number, height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function uploadFile(file: File, uploadPrefix?: string): Promise<string> {
  const config = useRuntimeConfig()
  const apiPrefix = config.public.autoadmin.apiPrefix
  const formData = new FormData()
  formData.append('file', file)

  const params = new URLSearchParams({
    prefix: uploadPrefix || '',
    fileType: file.type,
  })

  try {
    const response = await fetch(`${apiPrefix}/file-upload?${params}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(response.statusText)
    }

    const result = await response.text()
    return result
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    window.alert(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

export interface HandleFilesOptions {
  alt?: string | null
  caption?: string | null
}

/** Simple check: does the filename/path segment look like a word or phrase (not a hash, UUID, or only numbers)? */
export function looksLikeFilenameWord(name: string): boolean {
  let stem = name.replace(/\.[^.]+$/, '').trim()
  try {
    stem = decodeURIComponent(stem)
  }
  catch {
    /* leave as-is */
  }
  if (!stem || stem.length > 40)
    return false
  if (/^[0-9a-f-]{36}$/i.test(stem))
    return false // UUID
  if (/^[a-f0-9]{20,}$/i.test(stem))
    return false // long hex hash
  if (/^\d+$/.test(stem))
    return false // only digits
  const hasLetter = /[a-z]/i.test(stem)
  const hasVowel = /[aeiou]/i.test(stem)
  return hasLetter && hasVowel
}

/** Derive alt text from filename (strip extension, replace -_ with space, sentence case). Returns '' if filename doesn't look word-like. */
export function getAltFromFilename(name: string): string {
  if (!looksLikeFilenameWord(name))
    return ''
  const base = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || name
  return base.length ? base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() : base
}

/** Derive alt text from image URL (last path segment, same formatting as getAltFromFilename). Returns '' if segment doesn't look word-like. */
export function getAltFromUrl(urlStr: string): string {
  try {
    const pathname = urlStr.startsWith('http://') || urlStr.startsWith('https://')
      ? new URL(urlStr).pathname
      : urlStr.split('?')[0]
    const name = pathname?.split('/').filter(Boolean).pop() ?? ''
    if (!looksLikeFilenameWord(name))
      return ''
    return getAltFromFilename(decodeURIComponent(name))
  }
  catch {
    return ''
  }
}

/** Returns the document position of the first inserted image/figure, or undefined if none. */
export async function handleFiles(
  files: File[],
  editor: Editor,
  uploadPrefix?: string,
  pos?: number,
  options?: HandleFilesOptions,
): Promise<number | undefined> {
  if (pos === undefined) {
    pos = editor.state.selection.anchor
  }
  let firstImagePos: number | undefined
  const caption = options?.caption?.trim() || undefined
  for (const file of files) {
    try {
      const uploadedUrl = await uploadFile(file, uploadPrefix)
      if (['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.type)) {
        if (firstImagePos === undefined)
          firstImagePos = pos
        const alt = (options?.alt?.trim() || undefined) ?? getAltFromFilename(file.name)
        const dims = await getImageDimensions(uploadedUrl)
        const sizeAttrs = dims
          ? { width: dims.width, height: dims.height }
          : {}
        if (caption) {
          editor
            .chain()
            .insertContentAt(pos, {
              type: 'figure',
              attrs: { src: uploadedUrl, alt: alt ?? '', ...sizeAttrs },
              content: [{ type: 'text', text: caption }],
            })
            .focus()
            .run()
        }
        else {
          editor
            .chain()
            .insertContentAt(pos, {
              type: 'image',
              attrs: { src: uploadedUrl, alt: alt ?? '', ...sizeAttrs },
            })
            .focus()
            .run()
        }
        pos += (editor.state.doc.nodeAt(pos)?.nodeSize ?? 1)
      }
      else {
        editor
          .chain()
          .insertContentAt(pos, {
            type: 'text',
            text: file.name,
            marks: [{ type: 'link', attrs: { href: uploadedUrl } }],
          })
          .focus()
          .run()
      }
    }
    catch (error) {
      console.error('Failed to upload file:', error)
    }
  }
  return firstImagePos
}
