<script setup lang="ts">
import type { FilterSpec } from '#layers/autoadmin/server/utils/filter'
import { normalizeOptions } from '#layers/autoadmin/utils/form'

const props = defineProps<{
  modelValue: any
  filter: FilterSpec
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const internalValue = ref(props.modelValue)

const { data: selectMenuItemsRaw, status, execute } = await useLazyFetch<{
  label?: string
  value: string | number
}[] | string[]>(props.filter.choicesEndpoint ?? '', {
  immediate: false,
})

const selectMenuItems = computed(() =>
  selectMenuItemsRaw.value ? normalizeOptions(selectMenuItemsRaw.value) : [],
)

if (props.filter.options) {
  selectMenuItemsRaw.value = props.filter.options
  // Handle the case where the modelValue is a string and the options are numbers
  // modelValue can be a string because it is extracted from the url query params
  // convert relation select menu value to number if options suggest it is a number
  if (typeof props.modelValue === 'string' && props.modelValue !== '' && props.filter.options.length && typeof props.filter.options[0] === 'object' && typeof props.filter.options[0].value === 'number') {
    internalValue.value = Number(props.modelValue)
  }
}
const selectFetched = ref(false)

// TODO: Implement pagination of choices - https://github.com/nuxt/ui/issues/2744
// Maybe use v-select until fix found for Nuxt UI/Reka UI
function onSelectMenuOpen() {
  if (!selectFetched.value && props.filter.choicesEndpoint) {
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
  if (typeof internalValue.value === 'number' && typeof newValue === 'string' && newValue.trim() !== '' && !Number.isNaN(Number(newValue))) {
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
