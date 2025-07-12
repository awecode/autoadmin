<script setup lang="ts">
import type { FormSpec } from '~/utils/form'

const props = defineProps<{
  field: FormSpec['fields'][number]
  modelValue: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

// Helper function to format Date to datetime-local string using local time
const formatDateToLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Helper function to format Date to date string (yyyy-MM-dd)
const formatDateToDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fieldValue = computed({
  get: () => {
    if (props.field.type === 'datetime-local') {
      // Format Date object to yyyy-MM-ddThh:mm format for datetime-local input using local time
      if (props.modelValue instanceof Date) {
        return formatDateToLocal(props.modelValue)
      } else if (typeof props.modelValue === 'string' && props.modelValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
        // Convert ISO format string to local time, then format for datetime-local
        return formatDateToLocal(new Date(props.modelValue))
      }
      return props.modelValue
    } else if (props.field.type === 'date') {
      // Format Date object to yyyy-MM-dd format for date input
      if (props.modelValue instanceof Date) {
        return formatDateToDateString(props.modelValue)
      } else if (typeof props.modelValue === 'string' && props.modelValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
        // Convert ISO format string to date string
        return formatDateToDateString(new Date(props.modelValue))
      }
      return props.modelValue
    }
    return props.modelValue
  },
  set: (value) => {
    // Coerce to Date object for datetime-local and date fields
    if ((props.field.type === 'datetime-local' || props.field.type === 'date') && value) {
      emit('update:modelValue', new Date(value))
    } else {
      emit('update:modelValue', value)
    }
  },
})

// Ensure initial datetime-local and date values are converted to Date objects
if ((props.field.type === 'datetime-local' || props.field.type === 'date') && props.modelValue && typeof props.modelValue === 'string') {
  emit('update:modelValue', new Date(props.modelValue))
}

const { data: selectMenuItems, status, execute } = await useLazyFetch<{
  label: string
  value: string
}[]>(props.field.choicesEndpoint ?? '', {
  immediate: false,
})

if (props.field.selectItems) {
  selectMenuItems.value = props.field.selectItems
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
</script>

<template>
  <UFormField
    v-if="field.type === 'relation'"
    :label="field.label"
    :name="field.name"
  >
    <USelectMenu
      v-model="fieldValue"
      trailing
      class="w-full"
      label-key="label"
      value-key="value"
      :items="selectMenuItems ?? []"
      :loading="status === 'pending'"
      @update:open="onSelectMenuOpen"
    />
  </UFormField>
  <UFormField
    v-else-if="field.type === 'relation-many'"
    :label="field.label"
    :name="field.name"
  >
    <USelectMenu
      v-model="fieldValue"
      multiple
      trailing
      class="w-full"
      label-key="label"
      value-key="value"
      :items="selectMenuItems ?? []"
      :loading="status === 'pending'"
      @update:open="onSelectMenuOpen"
    />
  </UFormField>
  <UFormField v-else-if="field.type === 'select'" :label="field.label" :name="field.name">
    <USelect v-model="fieldValue" class="w-full" :items="field.enumValues" />
  </UFormField>
  <UFormField
    v-else-if="field.type === 'json'"
    :label="field.label"
    :name="field.name"
  >
    <UTextarea
      v-model="fieldValue"
      class="w-full font-mono"
      placeholder="{}"
      spellcheck="false"
      :rows="6"
    />
  </UFormField>
  <UFormField v-else-if="field.type === 'datetime-local'" :label="field.label" :name="field.name">
    <UInput
      v-model="fieldValue"
      :max="field.rules?.max"
      :min="field.rules?.min"
      :type="field.type"
    />
  </UFormField>
  <UFormField v-else-if="field.type === 'checkbox'" :label="field.label" :name="field.name">
    <UCheckbox v-model="fieldValue" />
  </UFormField>
  <UFormField v-else :label="field.label" :name="field.name">
    <UInput
      v-model="fieldValue"
      :max="field.rules?.max"
      :min="field.rules?.min"
      :type="field.type"
    />
  </UFormField>
</template>
