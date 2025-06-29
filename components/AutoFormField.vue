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
    }
    return props.modelValue
  },
  set: (value) => {
    // Coerce to Date object for datetime-local fields
    if (props.field.type === 'datetime-local' && value) {
      const dateValue = new Date(value)
      emit('update:modelValue', dateValue)
    } else {
      emit('update:modelValue', value)
    }
  },
})
</script>

<template>
  <UFormField
    v-if="field.type === 'relation'"
    :label="field.label"
    :name="field.name"
  >
    <USelect
      v-model="fieldValue"
      class="w-full"
      value-key="value"
      :items="field.selectItems"
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
