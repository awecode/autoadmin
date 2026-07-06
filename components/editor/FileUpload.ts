import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
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

  const params = new URLSearchParams({
    prefix: uploadPrefix || '',
    fileType: file.type,
    fileName: file.name,
  })

  try {
    const response = await fetch(`${apiPrefix}/file-upload?${params}`, {
      method: 'POST',
      body: file,
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

/** Find an image/figure node by its current src (blob URLs are unique per placeholder). */
function findImageNodeBySrc(editor: Editor, src: string): { pos: number, node: ProseMirrorNode } | undefined {
  let found: { pos: number, node: ProseMirrorNode } | undefined
  editor.state.doc.descendants((node, pos) => {
    if (found)
      return false
    if ((node.type.name === 'image' || node.type.name === 'figure') && node.attrs.src === src) {
      found = { pos, node }
      return false
    }
    return true
  })
  return found
}

function updateImageAttrsBySrc(editor: Editor, src: string, attrs: Record<string, any>) {
  const found = findImageNodeBySrc(editor, src)
  if (!found)
    return
  const tr = editor.state.tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, ...attrs })
  editor.view.dispatch(tr)
}

function removeImageNodeBySrc(editor: Editor, src: string) {
  const found = findImageNodeBySrc(editor, src)
  if (!found)
    return
  const tr = editor.state.tr.delete(found.pos, found.pos + found.node.nodeSize)
  editor.view.dispatch(tr)
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
    if (['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      if (firstImagePos === undefined)
        firstImagePos = pos
      const alt = (options?.alt?.trim() || undefined) ?? getAltFromFilename(file.name)
      // Insert a local blob-URL placeholder immediately for upload feedback;
      // editor CSS dims img[src^="blob:"] while the upload is in progress.
      const blobUrl = URL.createObjectURL(file)
      const dims = await getImageDimensions(blobUrl)
      const sizeAttrs = dims
        ? { width: dims.width, height: dims.height }
        : {}
      if (caption) {
        editor
          .chain()
          .insertContentAt(pos, {
            type: 'figure',
            attrs: { src: blobUrl, alt: alt ?? '', ...sizeAttrs },
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
            attrs: { src: blobUrl, alt: alt ?? '', ...sizeAttrs },
          })
          .focus()
          .run()
      }
      pos += (editor.state.doc.nodeAt(pos)?.nodeSize ?? 1)
      try {
        const uploadedUrl = await uploadFile(file, uploadPrefix)
        updateImageAttrsBySrc(editor, blobUrl, { src: uploadedUrl })
      }
      catch (error) {
        removeImageNodeBySrc(editor, blobUrl)
        console.error('Failed to upload file:', error)
      }
      finally {
        URL.revokeObjectURL(blobUrl)
      }
    }
    else {
      try {
        const uploadedUrl = await uploadFile(file, uploadPrefix)
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
      catch (error) {
        console.error('Failed to upload file:', error)
      }
    }
  }
  return firstImagePos
}
