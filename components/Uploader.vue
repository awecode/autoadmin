<script setup lang="ts">
const { label, name, modelValue = undefined, allowedExtensions = ['.jpg', '.jpeg', '.png'], folder, fullWidth = false, type = undefined, forAdminPanel = false, ui = {} } = defineProps<{
  label: string
  name: string
  modelValue?: string | number | undefined | null
  allowedExtensions?: string[]
  folder?: string
  fullWidth?: boolean
  type?: string
  forAdminPanel?: boolean
  ui?: object
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const imageRef = ref<any | null>(null)

const uploadedFile = ref(modelValue)

const fileUrl = ref(typeof modelValue === 'string' ? modelValue : undefined)

const isFileUploading = ref(false)

const toast = useToast()
// const { t } = useI18n()
const onImageClear = () => {
  uploadedFile.value = undefined
  fileUrl.value = undefined
  emit('update:modelValue', undefined)
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

  if (file && !allowedExtensions.includes(currentExtension)) {
    toast.add({
      title: 'Invalid file type',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
    })
    isFileUploading.value = false
    if (imageRef.value) {
      imageRef.value.input.value = ''
    }
    return
  }
  //  check file size
  if (file && file.size > 2 * 1024 * 1024) {
    toast.add({
      title: 'File size is too large',
      description: 'Please upload a file smaller than 2MB',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
    })
    isFileUploading.value = false
    if (imageRef.value) {
      imageRef.value.input.value = ''
    }
    return
  }

  if (file) {
    const formData = new FormData()
    formData.append('file', file)
    const { data: uploadedImageUrl, error } = await useFetch(`/api/file-upload?folder=${folder || ''}`, {
      method: 'POST',
      body: formData,
    })
    if (error.value) {
      toast.add({
        title: error.value.data?.message || 'Something went wrong!',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'red',
      })
      onImageClear()
      if (imageRef.value) {
        imageRef.value.input.value = ''
      }
    }
    if (uploadedImageUrl.value) {
      uploadedFile.value = uploadedImageUrl.value
      fileUrl.value = uploadedImageUrl.value
      emit('update:modelValue', uploadedImageUrl.value)
    }
  }

  isFileUploading.value = false
}
const allowedExtensionsString = allowedExtensions.join(',')
function onClick() {
  if (isFileUploading.value) return
  imageRef.value.input.click()
  // imageRef.value?.click()
}
const onFileDrop = (event: DragEvent) => {
  event.preventDefault()
  if (event?.dataTransfer?.items) {
    if (event.dataTransfer.items.length === 1 && event.dataTransfer.items[0].kind === 'file') {
      const file = event.dataTransfer.items[0].getAsFile() as File
      handleFileChange(undefined, file)
    } else {
      toast.add({
        title: 'Upload Error!',
        description: 'Please upload single file.',
        color: 'red',
      })
    }
  }
}
const dragOverHandler = (event: Event) => {
  event.preventDefault()
}
</script>

<template>
  <div>
    <UFormGroup
      v-if="fullWidth"
      :error="fileUrl ? false : undefined"
      :label="label"
      :name="name"
      :ui="{ error: 'bottom-0 translate-y-[73px]', ...ui }"
    >
      <template #default="{ error }">
        <div
          class="relative grid h-28 w-full cursor-pointer place-content-center border border-dashed"
          :class="{ 'bg-white border-gray-300': forAdminPanel, 'bg-[#F6FEFF] border-brand-green': !forAdminPanel, 'border-red-500': error }"
          :ondragover="dragOverHandler"
          :ondrop="onFileDrop"
          @click="onClick"
        >
          <UInput
            ref="imageRef"
            class="hidden"
            type="file"
            :accept="allowedExtensionsString"
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
          <div v-else-if="fileUrl">
            <NuxtImg
              v-if="['jpg', 'png', 'jpeg'].includes(fileUrl.split('.').pop() || '%%^^')"
              alt="Uploaded Image"
              class="absolute left-0 top-0 h-full w-full object-contain"
              :src="getMediaUrl(fileUrl)"
            />
            <UIcon v-else class="text-5xl text-heading-tertiary" name="i-heroicons-document-check" />
          </div>
          <div v-else class="flex items-center gap-4 text-xl md:text-3xl" draggable="false">
            <svg
              v-if="forAdminPanel"
              class="text-grey-line h-16 w-16"
              height="32"
              viewBox="0 0 512 512"
              width="32"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M398.1 233.2c0-1.2.2-2.4.2-3.6 0-65-51.8-117.6-115.7-117.6-46.1 0-85.7 27.4-104.3 67-8.1-4.1-17.2-6.5-26.8-6.5-29.5 0-54.1 21.9-58.8 50.5C57.3 235.2 32 269.1 32 309c0 50.2 40.1 91 89.5 91H224v-80h-48.2l80.2-83.7 80.2 83.6H288v80h110.3c45.2 0 81.7-37.5 81.7-83.4 0-45.9-36.7-83.2-81.9-83.3z" fill="#CCD2E2" />
            </svg>
            <svg
              v-else
              height="2em"
              viewBox="0 0 24 24"
              width="2em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g
                fill="none"
                stroke="#6ce2a6"
                stroke-linecap="square"
                stroke-width="1"
              >
                <path d="M21.25 13V8.5a5 5 0 0 0-5-5h-8.5a5 5 0 0 0-5 5v7a5 5 0 0 0 5 5h6.26" stroke-linejoin="miter" />
                <path
                  d="m3.01 17l2.74-3.2a2.2 2.2 0 0 1 2.77-.27a2.2 2.2 0 0 0 2.77-.27l2.33-2.33a4 4 0 0 1 5.16-.43l2.47 1.91M8.01 10.17a1.66 1.66 0 1 0-.02-3.32a1.66 1.66 0 0 0 .02 3.32"
                  stroke-linejoin="miter"
                />
                <path d="M18.707 15v5" stroke-miterlimit="10" />
                <path d="m21 17.105l-1.967-1.967a.46.46 0 0 0-.652 0l-1.967 1.967" stroke-linejoin="miter" />
              </g>
            </svg>
            <span class="text-base text-heading-tertiary">{{ `Drag and drop ${type || 'image'} here` }}</span>
            <span class="text-base text-heading-tertiary">OR</span>
            <button v-if="forAdminPanel" class="rounded-md bg-swa-gray-500 px-6 py-3 text-xs uppercase text-heading-tertiary" type="button">
              BROWSE FILES
            </button>
            <UButton
              v-else
              class="text-swa-cerulean hover:bg-transparent"
              label="Click here to upload"
              variant="outline"
            />
          </div>
        </div>
      </template>
    </UFormGroup>
    <div v-else class="h-20">
      <div class="mb-1 text-base">
        {{ label }}
      </div>
      <div v-if="fileUrl">
        <div class="relative mt-2 h-28 w-28 border-2">
          <button
            class="absolute right-1 top-1 z-10 flex h-6 w-6 p-[1px] items-center justify-center rounded-full text-brand-secondary-500"
            type="button"
            @click="onImageClear"
          >
            <svg
              class="h-full w-full p-[2px] bg-gray-200 rounded-md"
              height="32"
              viewBox="0 0 256 256"
              width="32"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16M96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Zm-80-104v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0m48 0v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0" fill="currentColor" />
            </svg>
            <!-- <UIcon name="i-heroicons-x-mark" class="h-4 w-4" /> -->
          </button>
          <NuxtImg
            v-if="['jpg', 'png', 'jpeg'].includes(fileUrl.split('.').pop() || '%%^^')"
            alt="Uploaded Image"
            class="absolute h-full w-full object-contain"
            sizes="100vw sm:50vw md:400px"
            :src="getMediaUrl(fileUrl)"
          />
          <UIcon v-else class="text-7xl md:text-9xl" name="i-mdi-file-cloud" />
        </div>
      </div>
      <div v-else-if="isFileUploading" class="mt-2 flex items-center gap-2 text-heading-tertiary">
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
      <div v-else class="relative">
        <UFormGroup :name="name" :ui="{ error: 'bottom-0' }">
          <template #default="{ error }">
            <UInput
              ref="imageRef"
              size="lg"
              type="file"
              :accept="allowedExtensionsString"
              :ui="{ file: { base: 'bg-red-300' } }"
              @change="handleFileChange"
            >
              <template #trailing>
                <div
                  class="flex h-[95%] w-24 translate-x-[13.1px] items-center justify-center rounded-r-md text-xs text-heading-secondary"
                  :class="forAdminPanel ? 'bg-swa-gray-500' : 'bg-strokes'"
                >
                  Browse
                </div>
              </template>
            </UInput>
          </template>
        </UFormGroup>
      </div>
    </div>
  </div>
</template>
