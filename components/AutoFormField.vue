<script setup lang="ts">
import type { FormSpec } from '~/utils/form'

const props = defineProps<{
  field: FormSpec['fields'][number]
  modelValue: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const fieldValue = computed({
  get: () => {
    if (props.field.type === 'datetime-local' && props.modelValue instanceof Date) {
      // Format Date object to yyyy-MM-ddThh:mm format for datetime-local input
      return props.modelValue.toISOString().slice(0, 16)
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
