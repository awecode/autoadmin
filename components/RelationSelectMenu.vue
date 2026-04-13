<script setup lang="ts">
import type { FilterSpec } from '#layers/autoadmin/server/utils/filter'
import type { Option } from '#layers/autoadmin/server/utils/form'
import { normalizeOptions } from '#layers/autoadmin/utils/form'

const props = defineProps<{
  modelValue: any
  filter: FilterSpec
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const internalValue = ref(props.modelValue)
const staticOptions = props.filter.options ?? []
const hasStaticOptions = staticOptions.length > 0

// Only set up fetch if non-empty static options don't exist but choicesEndpoint does
const shouldFetch = !hasStaticOptions && props.filter.choicesEndpoint
const { data: selectMenuItemsRaw, execute } = shouldFetch && props.filter.choicesEndpoint
  ? await useLazyFetch<Option[] | string[]>(props.filter.choicesEndpoint, {
      immediate: false,
    })
  : { data: ref(null), execute: () => {} }

const selectMenuItems = computed(() => {
  if (hasStaticOptions) {
    return normalizeOptions(staticOptions)
  }
  return selectMenuItemsRaw.value ? normalizeOptions(selectMenuItemsRaw.value) : []
})

if (hasStaticOptions) {
  // Handle the case where the modelValue is a string and the options are numbers
  // modelValue can be a string because it is extracted from the url query params
  // convert relation select menu value to number if options suggest it is a number
  if (typeof props.modelValue === 'string' && props.modelValue !== '' && typeof staticOptions[0] === 'object' && typeof staticOptions[0].value === 'number') {
    internalValue.value = Number(props.modelValue)
  }
}
const selectFetched = ref(false)
const isLoadingChoices = ref(false)

async function onSelectMenuOpen(open: boolean) {
  if (open && !selectFetched.value && shouldFetch) {
    isLoadingChoices.value = true
    try {
      await execute()
      selectFetched.value = true
    }
    finally {
      isLoadingChoices.value = false
    }
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
  }
  else {
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
    value-key="value"
    :virtualize="selectMenuItems.length > 100"
    :content="{ align: 'start' }"
    :items="selectMenuItems ?? []"
    :loading="isLoadingChoices"
    :placeholder="filter.label"
    :ui="{ content: 'min-w-fit' }"
    @update:open="onSelectMenuOpen"
  >
    <template #empty>
      {{ isLoadingChoices ? 'Loading...' : 'No data' }}
    </template>
  </USelectMenu>
</template>
