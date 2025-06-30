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
  values?: Record<string, any>
}>()

const loading = ref(false)

// Initialize state with values for update and default values for create
const initializeState = () => {
  if (props.values) {
    return reactive(props.values) as Record<string, any>
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

const toast = useToast()

const router = useRouter()
const performCreate = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ success: boolean }>(props.endpoint, {
      method: 'POST',
      body: state,
    })

    if (response.success) {
      toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
      if (props.redirectPath) {
        await router.push(props.redirectPath)
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      toast.add({ title: 'Error', description: `Failed to create: ${error.message}`, color: 'error' })
    } else {
      toast.add({ title: 'Error', description: `Failed to create: ${error}`, color: 'error' })
    }
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
      toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
      if (props.redirectPath) {
        await router.push(props.redirectPath)
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      toast.add({ title: 'Error', description: `Failed to update: ${error.message}`, color: 'error' })
    } else {
      toast.add({ title: 'Error', description: `Failed to update: ${error}`, color: 'error' })
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    {{ state }}
    <UForm
      class="space-y-4"
      :schema="processedSchema"
      :state="state"
      @error="console.error"
      @submit="mode === 'create' ? performCreate() : performUpdate()"
    >
      <div v-for="field in spec.fields" :key="field.name">
        <AutoFormField v-model="state[field.name]" :field="field" />
      </div>
      <div class="flex items-center justify-between">
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          type="submit"
          :disabled="loading"
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
