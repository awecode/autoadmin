<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { UnknownKeysParam, ZodObject, ZodRawShape, ZodTypeAny } from 'zod'

import type { FormSpec } from '~/utils/form'
import { processSchema } from '~/utils/schema'

const props = defineProps<{
  spec: FormSpec
  mode: 'create' | 'update'
  cancelPath?: RouteLocationRaw
  redirectPath?: RouteLocationRaw
  endpoint: string
  schema: ZodObject<ZodRawShape, UnknownKeysParam, ZodTypeAny, { [x: string]: any }, { [x: string]: any }>
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
const processedSchema = computed(() => processSchema(props.schema, props.spec))

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

// Track unsaved changes
const originalState = ref<Record<string, any>>({})
const hasUnsavedChanges = ref(false)
const navigationWarningEnabled = true

// Initialize original state and track changes
watchEffect(() => {
  if (props.spec.values && Object.keys(originalState.value).length === 0) {
    originalState.value = { ...props.spec.values }
  }
})

// Watch for changes in form state
watch(state, (newState) => {
  if (Object.keys(originalState.value).length === 0) {
    originalState.value = { ...newState }
    hasUnsavedChanges.value = false
    return
  }

  // Check if current state differs from original
  hasUnsavedChanges.value = JSON.stringify(newState) !== JSON.stringify(originalState.value)
}, { deep: true })

const handleError = (error: Error) => {
  if (error instanceof Error) {
    if ('data' in error) {
      const errorData = error.data as ApiErrorResponse
      if (errorData.data?.errors) {
        form.value?.setErrors(errorData.data.errors)
      }
    } else {
      toast.add({ title: 'Error', description: `Failed to create: ${error.message || error}`, color: 'error' })
    }
  }
}

// Router navigation warning
const router = useRouter()
const performCreate = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ success: boolean }>(props.endpoint, {
      method: 'POST',
      body: state,
    })

    if (response.success) {
      // Disable navigation warning on successful submission
      hasUnsavedChanges.value = false

      toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
      if (props.redirectPath) {
        await router.push(props.redirectPath)
      }
    }
  } catch (error) {
    handleError(error as Error)
  } finally {
    loading.value = false
  }
}

const performUpdate = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ success: boolean }>(props.endpoint, {
      method: 'PUT',
      body: state,
    })

    if (response.success) {
      // Disable navigation warning on successful submission
      hasUnsavedChanges.value = false

      toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
      if (props.redirectPath) {
        await router.push(props.redirectPath)
      }
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

// Browser beforeunload warning
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value && navigationWarningEnabled) {
    event.preventDefault()
    event.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    return event.returnValue
  }
}

// Router navigation warning
onMounted(() => {
  window.addEventListener('focusin', handleFocus)
  window.addEventListener('focusout', handleBlur)
  window.addEventListener('beforeunload', handleBeforeUnload)

  // Add router beforeEach guard for navigation warning
  router.beforeEach((to, from, next) => {
    if (hasUnsavedChanges.value && navigationWarningEnabled) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
      if (confirmed) {
        next()
      } else {
        next(false)
      }
    } else {
      next()
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('focusin', handleFocus)
  window.removeEventListener('focusout', handleBlur)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <div>
    <!-- Do not validate on input change when input is focused because it clears any server side validation error messages received from api -->
    <UForm
      ref="form"
      class="space-y-4 p-10 rounded-lg bg-gray-50 dark:bg-gray-800"
      :schema="processedSchema"
      :state="state"
      :validate-on="isInputFocused ? ['blur', 'change', 'input'] : ['change', 'blur']"
      @submit="mode === 'create' ? performCreate() : performUpdate()"
    >
      <div v-for="field in spec.fields" :key="field.name">
        <AutoFormField v-model="state[field.name]" :field="field" />
      </div>
      <div class="flex items-center justify-between">
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          type="submit"
          :class="{ 'cursor-not-allowed': loading || form?.errors?.length }"
          :disabled="loading || !!form?.errors?.length"
        >
          {{ loading ? mode === 'create' ? 'Creating...' : 'Updating...' : mode === 'create' ? 'Create' : 'Update' }}
        </button>
        <NuxtLink
          v-if="cancelPath || redirectPath"
          class="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
          :to="cancelPath || redirectPath"
        >
          Cancel
        </NuxtLink>
      </div>
    </UForm>
  </div>
</template>
