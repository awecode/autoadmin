<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor
  autoOpen?: boolean
}>()

type EmbedType = 'youtube' | 'iframe'

const open = ref(false)
const embedType = ref<EmbedType>('youtube')
const value = ref('')
const width = ref('')
const height = ref('')

const active = computed(() => props.editor.isActive('embed'))
const disabled = computed(() => {
  if (!props.editor.isEditable)
    return true
  return false
})

watch(active, (isActive) => {
  if (isActive && props.autoOpen)
    open.value = true
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

function setEmbed() {
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
  }
  else {
    if (!/^https?:\/\//i.test(input))
      return
    if (kind === 'youtube') {
      src = getYoutubeEmbedSrc(input)
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
        <UFormField label="Embed type">
          <USelect
            v-model="embedType"
            :items="[
              { label: 'YouTube', value: 'youtube' },
              { label: 'Iframe', value: 'iframe' },
            ]"
          />
        </UFormField>

        <UFormField label="URL or embed code">
          <UTextarea
            v-model="value"
            name="embed"
            :rows="4"
            variant="outline"
            placeholder="Paste a URL or iframe code"
            @keydown="handleKeyDown"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Width">
            <UInput
              v-model="width"
              name="width"
              type="text"
              variant="outline"
              placeholder="100%"
            />
          </UFormField>
          <UFormField label="Height">
            <UInput
              v-model="height"
              name="height"
              type="text"
              variant="outline"
              placeholder="auto"
            />
          </UFormField>
        </div>
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          class="mt-2 w-full"
          :disabled="!value.trim()"
          @click="setEmbed"
        >
          Save
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
