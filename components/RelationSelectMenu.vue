<script setup lang="ts">
import type { FilterSpec } from '#layers/autoadmin/utils/filter'

const props = defineProps<{
  modelValue: any
  filter: FilterSpec
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const internalValue = ref(props.modelValue)

const { data: selectMenuItems, status, execute } = await useLazyFetch<{
  label: string
  value: string
}[]>(props.filter.choicesEndpoint ?? '', {
  immediate: false,
})

if (props.filter.options) {
  selectMenuItems.value = props.filter.options
}
const selectFetched = ref(false)

// TODO: Implement pagination of choices - https://github.com/nuxt/ui/issues/2744
// Maybe use v-select until fix found for Nuxt UI/Reka UI
function onSelectMenuOpen() {
  if (!selectFetched.value) {
    execute()
    selectFetched.value = true
  }
}

watch(internalValue, (value) => {
  emit('update:modelValue', value)
})
</script>

<template>
  {{ filter }}
  <USelectMenu
    v-model="internalValue"
    class="min-w-32"
    size="xs"
    value-key="value"
    :items="selectMenuItems ?? []"
    :loading="status === 'pending'"
    :placeholder="filter.label"
    @update:open="onSelectMenuOpen"
  />
</template>
