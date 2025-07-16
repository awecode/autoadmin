<script setup lang="ts">
import type { FormSpec } from '~/utils/form'
import { normalizeOptions } from '~/utils/form'

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
    if (props.field.type === 'datetime-local' || props.field.type === 'date') {
      const formatter = props.field.type === 'datetime-local' ? formatDateToLocal : formatDateToDateString
      if (props.modelValue instanceof Date) {
        return formatter(props.modelValue)
      } else if (typeof props.modelValue === 'string' && props.modelValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
        return formatter(new Date(props.modelValue))
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

const { data: selectMenuItemsRaw, status, execute } = await useLazyFetch<{
  label: string
  value: string | number
}[]>(props.field.choicesEndpoint ?? '', {
  immediate: false,
})

const selectMenuItems = computed(() =>
  selectMenuItemsRaw.value ? normalizeOptions(selectMenuItemsRaw.value) : [],
)

if (props.field.selectItems) {
  selectMenuItemsRaw.value = props.field.selectItems
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
    :label="field.label"
    :name="field.name"
    :required="field.required"
  >
    <!-- Relation (single select) -->
    <USelectMenu
      v-if="field.type === 'relation'"
      v-model="fieldValue"
      trailing
      class="w-full"
      label-key="label"
      value-key="value"
      :items="selectMenuItems ?? []"
      :loading="status === 'pending'"
      @update:open="onSelectMenuOpen"
    />

    <!-- Relation (multi-select) -->
    <USelectMenu
      v-else-if="field.type === 'relation-many'"
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

    <!-- Select dropdown -->
    <USelect
      v-else-if="field.type === 'select'"
      v-model="fieldValue"
      class="w-full"
      :items="field.enumValues"
    />

    <!-- JSON textarea -->
    <UTextarea
      v-else-if="field.type === 'json'"
      v-model="fieldValue"
      class="w-full font-mono"
      placeholder="{}"
      spellcheck="false"
      :rows="6"
    />

    <!-- Date picker -->
    <DatePicker
      v-else-if="field.type === 'date'"
      v-model="fieldValue"
    />

    <!-- Checkbox -->
    <UCheckbox
      v-else-if="field.type === 'checkbox'"
      v-model="fieldValue"
    />

    <!-- Text input with nullify modifier -->
    <UInput
      v-else-if="field.type === 'text'"
      v-model.nullify="fieldValue"
      type="text"
    />

    <!-- Default input (datetime-local, number, etc.) -->
    <UInput
      v-else
      v-model="fieldValue"
      :max="field.rules?.max"
      :min="field.rules?.min"
      :type="field.type"
    />
  </UFormField>
</template>
