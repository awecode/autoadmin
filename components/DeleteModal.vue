<script setup lang="ts">
defineEmits<{
  close: []
  confirm: []
}>()
</script>

<template>
  <UModal>
    <template #content>
      <div class="p-4">
        <h3 class="text-lg font-medium mb-2">
          Confirm Delete
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete this item? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <UButton
            color="neutral"
            label="Cancel"
            variant="soft"
            @click="$emit('close')"
          />
          <UButton
            color="error"
            label="Delete"
            variant="solid"
            @click="$emit('confirm')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
