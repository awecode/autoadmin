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
  value: string | number
}[]>(props.filter.choicesEndpoint ?? '', {
  immediate: false,
})

const normalizeOptions = (options: { label?: string, value: string | number, count?: number }[] | string[]) => {
  return options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option }
    }
    return { label: option.label || option.value?.toString(), value: option.value, count: option.count }
  })
}

if (props.filter.options) {
  selectMenuItems.value = normalizeOptions(props.filter.options)
  // Handle the case where the modelValue is a string and the options are numbers
  // modelValue can be a string because it is extracted from the url query params
  if (typeof props.modelValue === 'string' && props.modelValue !== '') {
    selectMenuItems.value = selectMenuItems.value?.map(item => ({ ...item, value: item.value.toString() }))
  }
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

// Flag to prevent infinite recursion, or does Vue handle this?
let isUpdatingFromParent = false

watch(internalValue, (value) => {
  if (!isUpdatingFromParent) {
    emit('update:modelValue', value)
  }
})

// Watch for external changes to modelValue and sync them to internalValue
watch(() => props.modelValue, (newValue) => {
  isUpdatingFromParent = true
  if (typeof internalValue.value === 'number' && typeof newValue === 'string' && !isNaN(Number(newValue)) && newValue !== '') {
    internalValue.value = Number(newValue)
  } else {
    internalValue.value = newValue
  }
  nextTick(() => {
    isUpdatingFromParent = false
  })
})
</script>

<template>
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
