<script setup lang="ts">
defineEmits<{
  close: []
}>()

const title = 'File Preview'
const description = 'This is a preview of the file.'
</script>

<template>
  <UModal v-model="isPreviewDialogOpen">
    <UCard class="max-w-4xl w-full">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">
            File Preview
          </h3>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            @click="isPreviewDialogOpen = false"
          />
        </div>
      </template>

      <div class="max-h-96 overflow-auto">
        <!-- Image preview -->
        <img
          v-if="['jpg', 'png', 'jpeg', 'svg'].includes(previewFileType)"
          alt="Preview"
          class="w-full h-auto object-contain"
          :src="previewContent"
        />

        <!-- PDF preview -->
        <iframe
          v-else-if="previewFileType === 'pdf'"
          class="w-full h-96"
          frameborder="0"
          :src="previewContent"
        ></iframe>

        <!-- Text content preview -->
        <pre
          v-else-if="['txt', 'md'].includes(previewFileType)"
          class="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded"
        >{{ previewContent }}</pre>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
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
      </template>
    </UCard>
  </UModal>
</template>
