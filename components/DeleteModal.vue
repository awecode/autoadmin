<script setup lang="ts">
const props = defineProps<{
  onConfirm?: () => void | Promise<void>
}>()

defineEmits<{
  close: []
}>()

const title = 'Confirm Delete'
const description = 'Are you sure you want to delete this item? This action cannot be undone.'

const isDeleting = ref(false)

async function confirm() {
  if (isDeleting.value)
    return
  isDeleting.value = true
  try {
    await props.onConfirm?.()
  }
  finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UModal :description="description" :title="title" :dismissible="!isDeleting">
    <template #content>
      <div class="p-4">
        <h3 class="text-lg font-medium mb-2">
          {{ title }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {{ description }}
        </p>
        <div class="flex justify-end gap-3">
          <UButton
            aria-label="Cancel"
            color="neutral"
            label="Cancel"
            variant="soft"
            :disabled="isDeleting"
            @click="$emit('close')"
          />
          <UButton
            aria-label="Delete"
            color="error"
            label="Delete"
            variant="solid"
            :loading="isDeleting"
            @click="confirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
