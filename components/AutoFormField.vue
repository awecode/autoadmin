<script setup lang="ts">
import type { FormSpec } from '#layers/autoadmin/server/utils/form'
import { normalizeOptions, transformErrorMessage } from '#layers/autoadmin/utils/form'
import AutoFormModal from './AutoFormModal.vue'

const props = defineProps<{
  field: FormSpec['fields'][number]
  modelValue: any
  form?: any
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
  const cfg = registry.get(relatedConfigKey!)!
  const modelKey = cfg.key
  const modal = overlay.create(AutoFormModal, {
    props: {
      modelKey,
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
        if (props.field.type === 'relation-many') {
          // Only add the value if it's not already in the array
          if (!fieldValue.value || !fieldValue.value.includes(value)) {
            fieldValue.value = [...(fieldValue.value ?? []), value]
          }
        } else {
          fieldValue.value = value
        }
        // Clear any validation errors for this field after programmatic value change
        props.form.setErrors([], props.field.name)
        modal.close()
      },
    },
  })
  modal.open()
}
</script>

<template>
  <UFormField
    class="w-full p-2"
    :description="field.description"
    :help="field.help"
    :hint="field.hint"
    :label="field.label"
    :name="field.name"
    :required="field.required"
    v-bind="field.fieldAttrs"
  >
    <!-- Error slot with error message transformation -->
    <template #error="{ error }">
      <span v-if="error && typeof error === 'string'">
        {{ transformErrorMessage(error, field.type) }}
      </span>
      <span v-else-if="field.help" class="mt-2 text-muted">
        {{ field.help }}
      </span>
    </template>

    <template #default>
      <div :class="field.fieldAttrs?.class?.includes('w-full') ? field.fieldAttrs.class : 'max-w-2xl'">
        <!-- Relation (single select) -->
        <div v-if="field.type === 'relation'" class="flex items-center">
          <USelectMenu
            v-model="fieldValue"
            trailing
            class="w-full"
            label-key="label"
            value-key="value"
            v-bind="field.inputAttrs"
            :items="selectMenuItems ?? []"
            :loading="status === 'pending'"
            @update:open="onSelectMenuOpen"
          >
            <template #trailing>
              <ClientOnly>
                <UIcon
                  v-if="fieldValue"
                  class="text-dimmed px-2 hover:text-red-300"
                  name="i-lucide-x"
                  @click.stop="() => { fieldValue = null }"
                />
                <UIcon class="text-dimmed" name="i-lucide-chevron-down" />
              </ClientOnly>
            </template>
          </USelectMenu>
          <UButton
            v-if="field.relationConfig?.enableCreate"
            class="ml-1"
            color="neutral"
            icon="i-lucide-square-plus"
            variant="soft"
            @click.prevent="openRelationModal('create')"
          />
          <UButton
            v-if="field.relationConfig?.enableUpdate && fieldValue"
            color="neutral"
            icon="i-lucide-edit"
            variant="soft"
            @click.prevent="openRelationModal('update', fieldValue)"
          />
          <span v-else class="ml-6"></span>
        </div>

        <!-- Relation (multi-select) -->
        <div v-else-if="field.type === 'relation-many'" class="flex items-center">
          <USelectMenu
            v-model="fieldValue"
            multiple
            trailing
            class="w-full"
            label-key="label"
            value-key="value"
            v-bind="field.inputAttrs"
            :items="selectMenuItems ?? []"
            :loading="status === 'pending'"
            @update:open="onSelectMenuOpen"
          >
            <template #trailing>
              <ClientOnly>
                <UIcon
                  v-if="fieldValue"
                  class="text-dimmed px-2 hover:text-red-300"
                  name="i-lucide-x"
                  @click.stop="() => { fieldValue = [] }"
                />
                <UIcon class="text-dimmed size-5" name="i-lucide-chevron-down" />
              </ClientOnly>
            </template>
          </USelectMenu>
          <UButton
            v-if="field.relationConfig?.enableCreate"
            class="ml-1"
            color="neutral"
            icon="i-lucide-square-plus"
            variant="soft"
            @click.prevent="openRelationModal('create')"
          />
          <UButton
            v-if="field.relationConfig?.enableUpdate && fieldValue && Array.isArray(fieldValue) && fieldValue.length === 1"
            color="neutral"
            icon="i-lucide-edit"
            variant="soft"
            @click.prevent="openRelationModal('update', fieldValue[0])"
          />
          <span v-else class="ml-6"></span>
        </div>

        <!-- Select dropdown -->
        <USelect
          v-else-if="field.type === 'select'"
          v-model="fieldValue"
          class="w-full"
          v-bind="field.inputAttrs"
          :items="field.options"
        />

        <!-- JSON textarea -->
        <UTextarea
          v-else-if="field.type === 'json'"
          v-model="fieldValue"
          class="w-full font-mono"
          color="neutral"
          placeholder="{}"
          spellcheck="false"
          v-bind="field.inputAttrs"
          :rows="6"
        />

        <!-- Date picker -->
        <DatePicker
          v-else-if="field.type === 'date'"
          v-bind="field.inputAttrs"
          v-model="fieldValue"
        />

        <!-- Checkbox -->
        <UCheckbox
          v-else-if="field.type === 'boolean'"
          v-bind="field.inputAttrs"
          v-model="fieldValue"
          color="neutral"
        />

        <!-- Text input with nullify modifier -->
        <UInput
          v-else-if="field.type === 'text'"
          v-model.nullify="fieldValue"
          v-bind="field.inputAttrs"
          class="w-full"
          color="neutral"
          type="text"
        />

        <!-- Textarea input with nullify modifier -->
        <UTextarea
          v-else-if="field.type === 'textarea'"
          v-model.nullify="fieldValue"
          v-bind="field.inputAttrs"
          class="w-full"
          color="neutral"
        />

        <!-- Rich text editor -->
        <RichTextEditor
          v-else-if="field.type === 'rich-text'"
          v-model="fieldValue"
          class="w-full"
          :attrs="field.inputAttrs"
        />

        <Uploader
          v-else-if="field.type === 'image'"
          v-model="fieldValue"
          type="image"
          :attrs="field.inputAttrs"
          :config="field.fileConfig"
          :label="field.label ?? ''"
          :name="field.name"
        />

        <Uploader
          v-else-if="field.type === 'file'"
          v-model="fieldValue"
          type="file"
          :attrs="field.inputAttrs"
          :config="field.fileConfig"
          :label="field.label ?? ''"
          :name="field.name"
        />

        <UInput
          v-else-if="field.type === 'blob'"
          v-model="fieldValue"
          v-bind="field.inputAttrs"
          class="w-full"
          type="file"
          :accept="field.inputAttrs?.accept"
        />

        <UInput
          v-else-if="field.type === 'number'"
          v-model="fieldValue"
          v-bind="field.inputAttrs"
          class="w-full"
          step="any"
          type="number"
          :max="field.rules?.max"
          :min="field.rules?.min"
        />

        <!-- Default input (datetime-local, etc.) -->
        <UInput
          v-else
          v-model="fieldValue"
          class="w-full"
          color="neutral"
          :type="field.type"
        />
      </div>
    </template>
  </UFormField>
</template>
