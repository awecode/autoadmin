<script setup lang="ts">
import { formatBytes } from '../utils/string'

const props = defineProps<{
  label: string
  name: string
  modelValue?: string | number | undefined | null
  config?: {
    accept?: string[]
    prefix?: string
    maxSize?: number
  }
  type?: 'file' | 'image'
  attrs?: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const dialogPreviewExtensions = ['jpg', 'png', 'jpeg', 'svg', 'pdf', 'txt', 'md']

const allowedExtensions = props.config?.accept ?? (props.type === 'image' ? ['.jpg', '.jpeg', '.png', '.svg'] : [])
const allowedExtensionsString = allowedExtensions.join(', ')
const type = props.type ?? 'file'

const fileRef = useTemplateRef('fileRef')

const uploadedFile = ref(props.modelValue)

const fileUrl = ref(typeof props.modelValue === 'string' ? props.modelValue : undefined)

const isFileUploading = ref(false)

// Dialog preview state
const isPreviewDialogOpen = ref(false)
const previewContent = ref('')

// Computed file name
const fileName = computed(() => {
  if (!fileUrl.value) return ''
  return decodeURIComponent(fileUrl.value.split('/').pop() || '')
})

const toast = useToast()
// const { t } = useI18n()
const clearFile = () => {
  uploadedFile.value = ''
  fileUrl.value = ''
  emit('update:modelValue', '')
}
async function handleFileChange(e: Event | undefined, droppedFile: undefined | File = undefined) {
  isFileUploading.value = true
  let file = null
  if (droppedFile) {
    file = droppedFile
  } else if (e) {
    const target = e.target as HTMLInputElement
    if (!target?.files) {
      // @ts-expect-error fix this later
      file = e?.[0]
    } else {
      file = target.files?.[0]
    }
  }
  // check file type
  if (!file) {
    return
  }

  const currentExtension = `.${file.name.split('.').pop()}` as string

  if (file && allowedExtensions.length > 0 && !allowedExtensions.includes(currentExtension)) {
    toast.add({
      title: `Invalid file type - ${currentExtension}`,
      icon: 'i-lucide-triangle-alert',
      color: 'error',
    })
    isFileUploading.value = false
    if (fileRef.value?.inputRef) {
      fileRef.value.inputRef.value = ''
    }
    return
  }

  //  check file size
  if (props.config?.maxSize && file && file.size > props.config.maxSize) {
    toast.add({
      title: 'File size is too large',
      description: `Please upload a file smaller than ${formatBytes(props.config.maxSize)}`,
      icon: 'i-lucide-triangle-alert',
      color: 'error',
    })
    isFileUploading.value = false
    if (fileRef.value?.inputRef) {
      fileRef.value.inputRef.value = ''
    }
    return
  }

  if (file) {
    const formData = new FormData()
    formData.append('file', file)
    const fileType = encodeURIComponent(file.type)
    const uploadedFileUrl = await $fetch(`/api/autoadmin/file-upload?prefix=${props.config?.prefix || ''}&fileType=${fileType}`, {
      method: 'POST',
      body: formData,
      onResponseError: (error) => {
        toast.add({
          title: error.response._data?.message || error.response._data?.statusMessage || 'Upload failed!',
          icon: 'i-lucide-triangle-alert',
          color: 'error',
        })
        clearFile()
        if (fileRef.value?.inputRef) {
          fileRef.value.inputRef.value = ''
        }
      },
    })
    if (uploadedFileUrl) {
      uploadedFile.value = uploadedFileUrl
      fileUrl.value = uploadedFileUrl
      emit('update:modelValue', uploadedFileUrl)
    }
  }

  isFileUploading.value = false
}

function onClick() {
  if (isFileUploading.value) return
  fileRef.value?.inputRef?.click()
}

const onFileDrop = (event: DragEvent) => {
  event.preventDefault()
  if (event?.dataTransfer?.items) {
    if (event.dataTransfer.items.length === 1 && event.dataTransfer.items[0].kind === 'file') {
      const file = event.dataTransfer.items[0].getAsFile() as File
      handleFileChange(undefined, file)
    } else if (event.dataTransfer.items.length > 1) {
      toast.add({
        title: 'Upload Error',
        description: 'Please upload a single file.',
        color: 'error',
      })
    }
  }
}
const dragOverHandler = (event: Event) => {
  event.preventDefault()
}

const extension = computed(() => {
  if (!fileUrl.value) return ''
  return fileUrl.value.split('.').pop()?.toLowerCase() || ''
})

// Add new functions for the hover actions
const previewFile = async () => {
  if (fileUrl.value) {
    if (dialogPreviewExtensions.includes(extension.value)) {
      // Show in dialog for supported extensions
      if (['txt', 'md'].includes(extension.value)) {
        // Fetch text content for text files
        try {
          const response = await fetch(fileUrl.value)
          previewContent.value = await response.text()
        } catch (error) {
          console.error('Failed to fetch text content:', error)
          previewContent.value = 'Failed to load file content'
        }
      } else {
        // For images, SVG, PDF - use the URL directly
        previewContent.value = fileUrl.value
      }

      isPreviewDialogOpen.value = true
    } else {
      // Fall back to opening in new tab for unsupported extensions
      window.open(fileUrl.value, '_blank')
    }
  }
}

const downloadFile = async () => {
  if (fileUrl.value) {
    try {
      // Fetch the file as a blob to force download regardless of Content-Disposition
      const response = await fetch(fileUrl.value)
      const blob = await response.blob()

      // Create a blob URL and download it
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileUrl.value.split('/').pop() || 'file'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback to direct link if fetch fails
      const link = document.createElement('a')
      link.href = fileUrl.value
      link.download = fileUrl.value.split('/').pop() || 'file'
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
}

const replaceFile = () => {
  if (isFileUploading.value) return
  fileRef.value?.inputRef?.click()
}
</script>

<template>
  <div
    class="relative grid h-28 w-full cursor-pointer place-content-center border border-dashed group"
    :ondragover="dragOverHandler"
    :ondrop="onFileDrop"
    @click="onClick"
  >
    <UInput
      ref="fileRef"
      class="hidden"
      type="file"
      :accept="allowedExtensionsString"
      v-bind="attrs"
      @change="handleFileChange"
    />
    <div v-if="isFileUploading">
      <div class="flex items-center gap-2 text-heading-tertiary" variant="label">
        <svg
          height="32"
          viewBox="0 0 24 24"
          width="32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="2"
          >
            <path
              d="M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3"
              stroke-dasharray="2 4"
              stroke-dashoffset="6"
            >
              <animate
                attributeName="stroke-dashoffset"
                dur="0.6s"
                repeatCount="indefinite"
                values="6;0"
              />
            </path>
            <path
              d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21"
              stroke-dasharray="30"
              stroke-dashoffset="30"
            >
              <animate
                attributeName="stroke-dashoffset"
                begin="0.1s"
                dur="0.3s"
                fill="freeze"
                values="30;0"
              />
            </path>
            <path d="M12 16v-7.5" stroke-dasharray="10" stroke-dashoffset="10">
              <animate
                attributeName="stroke-dashoffset"
                begin="0.5s"
                dur="0.2s"
                fill="freeze"
                values="10;0"
              />
            </path>
            <path d="M12 8.5l3.5 3.5M12 8.5l-3.5 3.5" stroke-dasharray="6" stroke-dashoffset="6">
              <animate
                attributeName="stroke-dashoffset"
                begin="0.7s"
                dur="0.2s"
                fill="freeze"
                values="6;0"
              />
            </path>
          </g>
        </svg>
        Uploading...
      </div>
    </div>
    <div v-else-if="fileUrl" class="absolute inset-0 flex items-center justify-center">
      <!-- Image display -->
      <img
        v-if="['jpg', 'png', 'jpeg', 'svg'].includes(extension)"
        alt="Uploaded File"
        class="max-w-full max-h-full object-contain px-2"
        :src="fileUrl"
      />

      <!-- Non-image file display -->
      <div v-else class="flex flex-col items-center justify-center text-center px-4 py-2">
        <UIcon class="mb-3 text-2xl" name="i-lucide-file-check" />
        <div class="bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 max-w-full">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 break-all">
            {{ fileName }}
          </p>
          <p v-if="extension?.length > 0 && extension.length < 10" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ extension.toUpperCase() }} File
          </p>
        </div>
      </div>

      <!-- Hover overlay with action icons -->
      <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-4 pointer-events-none group-hover:pointer-events-auto">
        <!-- File name display -->
        <div class="bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 rounded-lg px-4 py-2 shadow-lg max-w-[80%]">
          <p class="text-sm font-medium text-gray-800 dark:text-gray-200 text-center break-all">
            {{ fileName }}
          </p>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-3">
          <UTooltip text="Preview">
            <UButton
              class="text-white hover:bg-white hover:bg-opacity-20 rounded-full cursor-pointer"
              icon="i-lucide-eye"
              size="xl"
              variant="ghost"
              @click.stop="previewFile"
            />
          </UTooltip>
          <UTooltip text="Download">
            <UButton
              class="text-white hover:bg-white hover:bg-opacity-20 rounded-full cursor-pointer"
              icon="i-lucide-download"
              size="xl"
              variant="ghost"
              @click.stop="downloadFile"
            />
          </UTooltip>
          <UTooltip text="Clear">
            <UButton
              class="text-white hover:bg-white hover:bg-opacity-20 rounded-full cursor-pointer"
              icon="i-lucide-x"
              size="xl"
              variant="ghost"
              @click.stop="clearFile"
            />
          </UTooltip>
          <UTooltip text="Replace">
            <UButton
              class="text-white hover:bg-white hover:bg-opacity-20 rounded-full cursor-pointer"
              icon="i-lucide-refresh-cw"
              size="xl"
              variant="ghost"
              @click.stop="replaceFile"
            />
          </UTooltip>
        </div>
      </div>
    </div>
    <div v-else class="flex items-center gap-4 text-xl md:text-3xl">
      <span class="text-sm text-gray-500">{{ `Drop ${type} here or click to upload` }}</span>
    </div>

    <!-- Preview Dialog -->
    <UModal
      v-model:open="isPreviewDialogOpen"
      fullscreen
      :description="`Preview of the file ${extension}`"
      :title="`Preview ${extension}`"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="flex-1 flex items-center justify-center p-4 overflow-auto">
            <!-- Image preview -->
            <img
              v-if="['jpg', 'png', 'jpeg', 'svg'].includes(extension)"
              alt="Preview"
              class="max-w-full max-h-[80vh] object-contain"
              :src="previewContent"
            />

            <!-- PDF preview -->
            <iframe
              v-else-if="extension === 'pdf'"
              class="w-full h-[80vh]"
              frameborder="0"
              :src="previewContent"
            ></iframe>

            <!-- Text content preview -->
            <div
              v-else-if="['txt', 'md'].includes(extension)"
              class="w-full max-h-full"
            >
              <pre class="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded dark:bg-gray-800 dark:text-white">{{ previewContent }}</pre>
            </div>
          </div>

          <div class="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <UButton
              variant="outline"
              @click="isPreviewDialogOpen = false"
            >
              Close
            </UButton>
            <UButton
              icon="i-lucide-download"
              @click="downloadFile"
            >
              Download
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
