import type { Editor } from '@tiptap/vue-3'

export async function uploadFile(file: File, uploadPrefix?: string): Promise<string> {
  const config = useRuntimeConfig()
  const apiPrefix = config.public.apiPrefix
  const formData = new FormData()
  formData.append('file', file)

  const params = new URLSearchParams({
    prefix: uploadPrefix || 'uploads/',
    fileType: file.type,
  })

  try {
    const response = await fetch(`${apiPrefix}/file-upload?${params}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
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

export async function handleFiles(files: File[], editor: Editor, uploadPrefix?: string, pos?: number) {
  if (!pos) {
    pos = editor.state.selection.anchor
  }
  for (const file of files) {
    try {
      const uploadedUrl = await uploadFile(file, uploadPrefix)
      if (['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(file.type)) {
        editor
          .chain()
          .insertContentAt(pos, {
            type: 'image',
            attrs: {
              src: uploadedUrl,
            },
          })
          .focus()
          .run()
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
}
