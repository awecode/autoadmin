<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { uploadFile } from './FileUpload'

const props = defineProps<{
  editor: Editor
  autoOpen?: boolean
  uploadPrefix?: string
}>()

type EmbedType = 'youtube' | 'iframe' | 'facebook' | 'linkedin' | 'pdf'

const open = ref(false)
const embedType = ref<EmbedType>('youtube')
const value = ref('')
const width = ref('')
const height = ref('')
const isUploading = ref(false)

const active = computed(() => props.editor.isActive('embed'))
const isEditing = computed(() => props.editor.isActive('embed'))
const disabled = computed(() => {
  if (!props.editor.isEditable)
    return true
  return false
})

function isProbablyCode(input: string) {
  return input.includes('<') && input.includes('>')
}

function parseIframeFromHtml(html: string) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const iframe = doc.querySelector('iframe')
    if (!iframe)
      return null
    const src = iframe.getAttribute('src') || ''
    const widthAttr = iframe.getAttribute('width') || ''
    const heightAttr = iframe.getAttribute('height') || ''
    return {
      src,
      width: widthAttr || null,
      height: heightAttr || null,
    }
  }
  catch {
    return null
  }
}

function getYoutubeEmbedSrc(urlStr: string): string | null {
  try {
    const url = new URL(urlStr)
    let id = ''
    if (url.hostname.includes('youtu.be')) {
      id = url.pathname.slice(1)
    }
    else if (url.searchParams.get('v')) {
      id = url.searchParams.get('v') || ''
    }
    else if (url.pathname.includes('/embed/')) {
      id = url.pathname.split('/embed/')[1]?.split(/[?&]/)[0] || ''
    }
    if (!id)
      return null
    return `https://www.youtube.com/embed/${id}`
  }
  catch {
    return null
  }
}

function getFacebookEmbedSrc(urlStr: string): string | null {
  try {
    const url = new URL(urlStr)
    // Basic check that it's a Facebook URL
    if (!/facebook\.com/.test(url.hostname))
      return null
    return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url.toString())}`
  }
  catch {
    return null
  }
}

function getLinkedInEmbedSrc(urlStr: string): string | null {
  try {
    const url = new URL(urlStr)
    if (!/linkedin\.com/.test(url.hostname))
      return null
    // If it's already an embed URL, keep as is.
    if (url.pathname.includes('/embed/'))
      return url.toString()
    // Common feed URL: /feed/update/urn:li:activity:...
    url.pathname = url.pathname.replace('/feed/update/', '/embed/feed/update/')
    return url.toString()
  }
  catch {
    return null
  }
}

watch(open, (isOpen) => {
  if (!isOpen || !isEditing.value)
    return
  const attrs = props.editor.getAttributes('embed') as { width?: string | null, height?: string | null }
  width.value = attrs.width ?? ''
  height.value = attrs.height ?? ''
})

function setEmbed() {
  if (isEditing.value) {
    const attrs: Record<string, unknown> = {}
    const w = width.value.trim()
    const h = height.value.trim()
    attrs.width = w || null
    attrs.height = h || null
    props.editor.chain().focus().updateAttributes('embed', attrs).run()
    open.value = false
    return
  }

  const input = value.value.trim()
  if (!input)
    return

  let kind: EmbedType = embedType.value
  let src: string | null = null
  let parsedWidth: string | null = null
  let parsedHeight: string | null = null

  if (isProbablyCode(input)) {
    const parsed = parseIframeFromHtml(input)
    if (!parsed || !parsed.src)
      return
    src = parsed.src
    parsedWidth = parsed.width
    parsedHeight = parsed.height
    if (/youtu\.be|youtube\.com/.test(src))
      kind = 'youtube'
    else if (/facebook\.com/.test(src))
      kind = 'facebook'
    else if (/linkedin\.com/.test(src))
      kind = 'linkedin'
    else if (/\.pdf(?:[?#]|$)/i.test(src))
      kind = 'pdf'
  }
  else {
    if (!/^https?:\/\//i.test(input))
      return
    if (kind === 'youtube') {
      src = getYoutubeEmbedSrc(input)
    }
    else if (kind === 'facebook') {
      src = getFacebookEmbedSrc(input)
    }
    else if (kind === 'linkedin') {
      src = getLinkedInEmbedSrc(input)
    }
    else if (kind === 'pdf') {
      src = input
    }
    else {
      src = input
    }
  }

  if (!src)
    return

  const attrs: Record<string, unknown> = {
    embedType: kind,
    src,
  }
  const finalWidth = width.value.trim() || parsedWidth
  const finalHeight = height.value.trim() || parsedHeight
  if (finalWidth)
    attrs.width = finalWidth
  if (finalHeight)
    attrs.height = finalHeight

  props.editor.chain().focus().insertContent({
    type: 'embed',
    attrs,
  }).run()

  open.value = false
  value.value = ''
  width.value = ''
  height.value = ''
}

async function handlePdfUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  isUploading.value = true
  try {
    const url = await uploadFile(file, props.uploadPrefix || 'content/')
    const attrs: Record<string, unknown> = {
      embedType: 'pdf',
      src: url,
    }
    const w = width.value.trim()
    const h = height.value.trim() || '600px'
    if (w) attrs.width = w
    attrs.height = h

    props.editor.chain().focus().insertContent({
      type: 'embed',
      attrs,
    }).run()

    open.value = false
    value.value = ''
    width.value = ''
    height.value = ''
  }
  catch (error) {
    console.error('PDF upload failed:', error)
  }
  finally {
    isUploading.value = false
    input.value = ''
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    setEmbed()
  }
}
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'p-0.5' }">
    <UTooltip text="Embed">
      <UButton
        icon="i-lucide-square-dashed-bottom-code"
        color="neutral"
        active-color="primary"
        variant="ghost"
        active-variant="soft"
        size="sm"
        :active="active"
        :disabled="disabled"
      />
    </UTooltip>

    <template #content>
      <div class="flex flex-col gap-2 p-2 min-w-72">
        <template v-if="!isEditing">
          <UFormField label="Embed type">
            <USelect
              v-model="embedType"
              :items="[
                { label: 'YouTube', value: 'youtube' },
                { label: 'Facebook post', value: 'facebook' },
                { label: 'LinkedIn post', value: 'linkedin' },
                { label: 'PDF', value: 'pdf' },
                { label: 'Iframe', value: 'iframe' },
              ]"
              :ui="{ content: 'w-full' }"
            />
          </UFormField>

          <UFormField label="URL or embed code">
            <UTextarea
              v-model="value"
              class="w-full"
              name="embed"
              :rows="4"
              variant="outline"
              placeholder="Paste a URL or iframe code"
              @keydown="handleKeyDown"
            />
          </UFormField>

          <template v-if="embedType === 'pdf'">
            <div class="flex items-center gap-2 text-sm text-dimmed">
              <div class="flex-1 border-t border-muted" />
              or
              <div class="flex-1 border-t border-muted" />
            </div>
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-upload"
              :loading="isUploading"
              @click="($refs.pdfInput as HTMLInputElement)?.click()"
            >
              Upload PDF
            </UButton>
            <input
              ref="pdfInput"
              type="file"
              accept=".pdf"
              class="hidden"
              @change="handlePdfUpload"
            >
          </template>
        </template>

        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Width">
            <UInput
              v-model="width"
              name="width"
              type="text"
              variant="outline"
              placeholder="100%"
              @keydown.enter.prevent="setEmbed"
            />
          </UFormField>
          <UFormField label="Height">
            <UInput
              v-model="height"
              name="height"
              type="text"
              variant="outline"
              placeholder="auto"
              @keydown.enter.prevent="setEmbed"
            />
          </UFormField>
        </div>
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          class="mt-2 inline"
          :disabled="!isEditing && !value.trim()"
          @click="setEmbed"
        >
          {{ isEditing ? 'Update' : 'Embed' }}
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
