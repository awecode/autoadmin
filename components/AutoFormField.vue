<script setup lang="ts">
import type { FormSpec } from '~/utils/form'
import AutoFormModal from '#layers/autoadmin/components/AutoFormModal.vue'
import { normalizeOptions } from '~/utils/form'
import { transformErrorMessage } from '~/utils/zod'

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
}[]>(props.field.relationConfig?.choicesEndpoint ?? '', {
  immediate: false,
})

const selectMenuItems = computed(() =>
  selectMenuItemsRaw.value ? normalizeOptions(selectMenuItemsRaw.value) : [],
)

if (props.field.options) {
  selectMenuItemsRaw.value = normalizeOptions(props.field.options)
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

const overlay = useOverlay()

async function openRelationModal(mode: 'create' | 'update', lookupValue?: string | number) {
  const registry = useAdminRegistry()
  const relationConfig = props.field.relationConfig
  if (!relationConfig) {
    return
  }
  const relatedConfigKey = relationConfig.relatedConfigKey
  const modelConfig = registry.get(relatedConfigKey!)!
  const label = modelConfig.label
  const modal = overlay.create(AutoFormModal, {
    props: {
      modelLabel: label,
      mode,
      lookupValue,
      onSave: (data) => {
        const value = data[relationConfig.foreignRelatedColumnName!]
        const option = {
          label: data[relationConfig.foreignLabelColumnName!],
          value,
        }
        if (mode === 'create') {
          selectMenuItemsRaw.value = normalizeOptions([...(selectMenuItemsRaw.value ?? []), option])
        } else if (selectMenuItemsRaw.value) {
          selectMenuItemsRaw.value = normalizeOptions(selectMenuItemsRaw.value.map(item => item.value === lookupValue ? option : item))
        }
        fieldValue.value = value
        modal.close()
      },
    },
  })
  modal.open()
}
</script>

<template>
  <UFormField
    :description="field.description"
    :help="field.help"
    :hint="field.hint"
    :label="field.label"
    :name="field.name"
    :required="field.required"
  >
    <!-- Error slot with error message transformation -->
    <template #error="{ error }">
      <span v-if="error && typeof error === 'string'">
        {{ transformErrorMessage(error, field.type) }}
      </span>
    </template>

    <template #default>
      <!-- Relation (single select) -->
      <div v-if="field.type === 'relation'" class="flex items-center">
        <USelectMenu
          v-model="fieldValue"
          trailing
          class="w-full"
          label-key="label"
          value-key="value"
          v-bind="field.attrs"
          :items="selectMenuItems ?? []"
          :loading="status === 'pending'"
          @update:open="onSelectMenuOpen"
        />
        <UButton
          v-if="field.relationConfig?.enableCreate"
          color="primary"
          icon="i-lucide-square-plus"
          variant="ghost"
          @click.prevent="openRelationModal('create')"
        />
        <UButton
          v-if="field.relationConfig?.enableUpdate && fieldValue"
          color="primary"
          icon="i-lucide-edit"
          variant="ghost"
          @click.prevent="openRelationModal('update', fieldValue)"
        />
      </div>

      <!-- Relation (multi-select) -->
      <USelectMenu
        v-else-if="field.type === 'relation-many'"
        v-model="fieldValue"
        multiple
        trailing
        class="w-full"
        label-key="label"
        value-key="value"
        v-bind="field.attrs"
        :items="selectMenuItems ?? []"
        :loading="status === 'pending'"
        @update:open="onSelectMenuOpen"
      />

      <!-- Select dropdown -->
      <USelect
        v-else-if="field.type === 'select'"
        v-model="fieldValue"
        class="w-full"
        v-bind="field.attrs"
        :items="field.options"
      />

      <!-- JSON textarea -->
      <UTextarea
        v-else-if="field.type === 'json'"
        v-model="fieldValue"
        class="w-full font-mono"
        placeholder="{}"
        spellcheck="false"
        v-bind="field.attrs"
        :rows="6"
      />

      <!-- Date picker -->
      <DatePicker
        v-else-if="field.type === 'date'"
        v-bind="field.attrs"
        v-model="fieldValue"
      />

      <!-- Checkbox -->
      <UCheckbox
        v-else-if="field.type === 'boolean'"
        v-bind="field.attrs"
        v-model="fieldValue"
      />

      <!-- Text input with nullify modifier -->
      <UInput
        v-else-if="field.type === 'text'"
        v-model.nullify="fieldValue"
        v-bind="field.attrs"
        type="text"
      />

      <!-- Textarea input with nullify modifier -->
      <UTextarea
        v-else-if="field.type === 'textarea'"
        v-model.nullify="fieldValue"
        v-bind="field.attrs"
      />

      <!-- Rich text editor -->
      <RichTextEditor
        v-else-if="field.type === 'rich-text'"
        v-model="fieldValue"
        v-bind="field.attrs"
      />

      <Uploader
        v-else-if="field.type === 'image'"
        v-model="fieldValue"
        v-bind="field.attrs"
        type="image"
        :config="field.fileConfig"
        :label="field.label"
        :name="field.name"
      />

      <Uploader
        v-else-if="field.type === 'file'"
        v-model="fieldValue"
        v-bind="field.attrs"
        type="file"
        :config="field.fileConfig"
        :label="field.label"
        :name="field.name"
      />

      <UInput
        v-else-if="field.type === 'blob'"
        v-model="fieldValue"
        v-bind="field.attrs"
        type="file"
        :accept="field.attrs?.accept"
      />

      <!-- Default input (datetime-local, number, etc.) -->
      <UInput
        v-else
        v-model="fieldValue"
        :max="field.rules?.max"
        :min="field.rules?.min"
        :type="field.type"
      />
    </template>
  </UFormField>
</template>
