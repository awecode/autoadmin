<script setup lang="ts">
import type { FormSpec } from '#layers/autoadmin/server/utils/form'
import type { RouteLocationRaw } from 'vue-router'

import type { ZodObject, ZodType } from 'zod'
import { useWarnOnUnsavedChanges } from '#layers/autoadmin/composables/unsavedWarning'
import { getErrorMessageFromError, processSchemaForForm } from '#layers/autoadmin/utils/form'

const props = defineProps<{
  spec: FormSpec
  mode: 'create' | 'update'
  cancelPath?: RouteLocationRaw
  redirectPath?: RouteLocationRaw
  endpoint: string
  schema: ZodObject<Record<string, ZodType>>
}>()

const emit = defineEmits<{
  save: [data: Record<string, any>]
}>()

const form = useTemplateRef('form')
const loading = ref(false)

// Initialize state with values for update and default values for create
const initializeState = () => {
  if (props.spec.values) {
    return reactive(props.spec.values) as Record<string, any>
  }

  const initialState: Record<string, any> = {}

  // If mode is create, populate with default values from spec
  if (props.mode === 'create' && props.spec.fields) {
    for (const field of props.spec.fields) {
      if (field.defaultValue !== undefined) {
        initialState[field.name] = field.defaultValue
      }
    }
  }

  return reactive(initialState) as Record<string, any>
}

const state = initializeState()

// Process schema to only include fields defined in spec
const processedSchema = computed(() => processSchemaForForm(props.schema, props.spec))

interface ApiErrorResponse {
  statusCode: number
  statusMessage: string
  stack: string[]
  data?: {
    message?: string
    errors?: {
      name: string
      message: string
    }[]
  }
}

const toast = useToast()

const { updateOriginalState } = useWarnOnUnsavedChanges(toRef(() => state), props.spec.values, {
  enabled: props.spec.warnOnUnsavedChanges ?? false,
})

const handleError = (error: Error) => {
  if (error instanceof Error) {
    if ('data' in error) {
      const errorData = error.data as ApiErrorResponse
      if (errorData.data?.errors) {
        form.value?.setErrors(errorData.data.errors)
        // Return not to show toast
        // Return only if all values for name key on errors match the name of a field in the form
        // Because the error may not bind to a field in the form and user may not see it
        if (errorData.data.errors.every(error => props.spec.fields?.some(field => field.name === error.name))) {
          return
        }
      }
    }
    toast.add({ title: 'Error', description: `Failed to save: ${getErrorMessageFromError(error)}`, color: 'error' })
  }
}

const router = useRouter()

const performSave = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ success: boolean, data: Record<string, any> }>(props.endpoint, {
      method: props.mode === 'create' ? 'POST' : 'PUT',
      body: state,
    })

    if (response.success) {
      updateOriginalState(state)
      const description = props.mode === 'create' ? 'Created successfully.' : 'Updated successfully.'
      toast.add({ title: 'Success', description, color: 'success' })
      if (props.redirectPath) {
        await router.push(props.redirectPath)
      }
      emit('save', response.data)
    }
  } catch (error) {
    handleError(error as Error)
  } finally {
    loading.value = false
  }
}

const focusedEl = ref<HTMLElement | null>(null)
const handleFocus = (event: FocusEvent) => focusedEl.value = event.target as HTMLElement
const handleBlur = () => focusedEl.value = null
const isInputFocused = computed(() => ['INPUT', 'TEXTAREA'].includes(focusedEl.value?.tagName || ''))
onMounted(() => {
  window.addEventListener('focusin', handleFocus)
  window.addEventListener('focusout', handleBlur)
})

onUnmounted(() => {
  window.removeEventListener('focusin', handleFocus)
  window.removeEventListener('focusout', handleBlur)
})
</script>

<template>
  <!-- Do not validate on input change when input is focused because it clears any server side validation error messages received from api -->
  <UForm
    ref="form"
    :schema="processedSchema"
    :state="state"
    :validate-on="isInputFocused ? ['blur', 'change', 'input'] : ['change', 'blur']"
    @submit="performSave()"
  >
    <div class="flex flex-wrap">
      <AutoFormField
        v-for="field in spec.fields"
        :key="field.name"
        v-model="state[field.name]"
        :field="field"
        :form="form"
      />
    </div>
    <div class="flex items-center justify-between mt-8">
      <UButton
        color="neutral"
        type="submit"
        variant="solid"
        :class="{ 'cursor-not-allowed': loading || form?.errors?.length }"
        :disabled="loading || !!form?.errors?.length"
      >
        {{ loading ? mode === 'create' ? 'Creating...' : 'Updating...' : mode === 'create' ? 'Create' : 'Update' }}
      </UButton>
      <UButton
        v-if="cancelPath || redirectPath"
        color="neutral"
        variant="soft"
        :to="cancelPath || redirectPath"
      >
        Cancel
      </UButton>
    </div>
  </UForm>
</template>
