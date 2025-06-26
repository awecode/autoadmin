<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { FormSpec } from '~/utils/form'

const props = defineProps<{
  spec: FormSpec
}>()

const state = reactive({}) as Record<string, any>

const toast = useToast()
async function onSubmit(event: FormSubmitEvent<any>) {
  toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
  console.log(event.data)
}
</script>

<template>
  <div>
    <UForm class="space-y-4" :state="state" @submit="onSubmit">
      <div v-for="field in spec.fields" :key="field.name">
        <AutoFormField :field="field" :state="state" />
      </div>
    </UForm>
  </div>
</template>
