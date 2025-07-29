<script setup lang="ts">
const props = defineProps<{
  label: string
  searchPlaceholder: string
  to: any
  close: () => void
}>()

const searchQuery = ref('')

function performSearch() {
  if (searchQuery.value.trim() && props.to) {
    props.close()
    navigateTo({
      ...props.to,
      query: { q: searchQuery.value.trim() },
    })
  }
}
</script>

<template>
  <UModal :title="`Search ${label}`">
    <template #body>
      <div class="space-y-4">
        <UInput
          v-model="searchQuery"
          autofocus
          class="w-full"
          :placeholder="searchPlaceholder || 'Search...'"
          @keyup.enter="performSearch"
        />

        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="close"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!searchQuery.trim()"
            @click="performSearch"
          >
            Search
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
