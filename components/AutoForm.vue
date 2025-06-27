<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { FormSpec } from '~/utils/form'
import * as z from 'zod'

const props = defineProps<{
  spec: FormSpec
  cancelPath?: RouteLocationRaw
  redirectPath?: RouteLocationRaw
  createEndpoint: string
  schema: Record<string, any>
}>()

console.log(props.schema)

const loading = ref(false)

const state = reactive({}) as Record<string, any>

const toast = useToast()

const router = useRouter()
const performCreate = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ success: boolean }>(props.createEndpoint, {
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
</script>

<template>
  <div>
    <UForm
      class="space-y-4"
      :schema="schema"
      :state="state"
      @submit="performCreate"
    >
      {{ state }}
      <div v-for="field in spec.fields" :key="field.name">
        <AutoFormField v-model="state[field.name]" :field="field" />
      </div>
      <div class="flex items-center justify-between">
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          type="submit"
          :disabled="loading"
        >
          {{ loading ? 'Creating...' : 'Create' }}
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
