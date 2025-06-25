<script setup lang="ts">
import { z } from 'zod'
import { fromError } from 'zod-validation-error'

interface Props {
  title: string
  subtitle?: string
  submitLabel?: string
  endpoint: string
  method?: 'POST' | 'PUT' | 'PATCH'
  redirectTo?: string
  schema?: z.ZodTypeAny
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  submitLabel: 'Submit',
  method: 'POST',
  redirectTo: '',
  schema: z.object({}),
})

const emit = defineEmits<{
  submit: [data: any]
  cancel: []
}>()

const toast = useToast()
const formLoading = ref(false)

// Fetch data if method is not POST
const { data, status } = props.method !== 'POST'
  ? useFetch<Record<string, any>>(props.endpoint, {
      onResponseError: (err: any) => {
        toast.add({
          title: 'Error',
          description: err.message || 'Failed to load data',
          color: 'error',
        })
        if (props.redirectTo) {
          navigateTo(props.redirectTo)
        }
      },
      lazy: true,
    })
  : { data: ref<Record<string, any>>({}), status: ref('idle') }

// Handle form submission
async function handleSubmit(event: Event) {
  event.preventDefault()
  try {
    formLoading.value = true
    await $fetch(props.endpoint, {
      method: props.method,
      body: data.value,
    })
    toast.add({
      title: 'Success',
      description: 'Operation completed successfully',
      color: 'success',
    })
    if (props.redirectTo) {
      navigateTo(props.redirectTo)
    }
    emit('submit', data.value)
  }
  catch (err: any) {
    let msg = 'Operation failed'
    let title = 'Error'
    if (err.data?.data?.issues) {
      const validationError = fromError(new z.ZodError(err.data.data.issues))
      msg = validationError.toString().replace('Validation error: ', '')
      title = 'Validation Error'
    }
    else if (err.data?.message || err.message) {
      msg = err.data?.message || err.message
      title = err.data?.statusMessage || 'Error'
    }
    toast.add({
      title,
      description: msg,
      color: 'error',
    })
  }
  finally {
    formLoading.value = false
  }
}

// Handle cancel
function handleCancel() {
  if (props.redirectTo) {
    navigateTo(props.redirectTo)
  }
  emit('cancel')
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <UCard class="shadow-sm dark:shadow-gray-800">
      <template #header>
        <div class="flex items-center justify-between px-2">
          <div>
            <h1 class="text-2xl font-semibold">
              {{ title }}
            </h1>
            <p v-if="subtitle" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ subtitle }}
            </p>
          </div>

          <UButton
            class="ml-auto"
            icon="i-heroicons-x-mark"
            variant="ghost"
            @click="handleCancel"
          />
        </div>
      </template>

      <div v-if="status === 'pending'" class="flex justify-center items-center h-64">
        <div class="space-y-6 w-full px-4">
          <USkeleton class="h-12 w-full" />
          <USkeleton class="h-12 w-1/2" />
          <USkeleton class="h-12 w-2/3" />
          <USkeleton class="h-28 w-full" />
        </div>
      </div>

      <UForm
        v-else
        :schema="schema"
        :state="data"
        class="space-y-6 px-4"
        @submit.prevent="handleSubmit"
      >
        <div class="flex flex-col gap-4">
          <slot :data="data">
            No form content provided
          </slot>
        </div>

        <div class="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
          <UButton
            color="neutral"
            variant="ghost"
            @click="handleCancel"
          >
            Cancel
          </UButton>

          <UButton
            color="primary"
            type="submit"
            :loading="formLoading"
          >
            {{ submitLabel }}
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
