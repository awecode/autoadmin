<script setup lang="ts">
import type { FormSpec } from '#layers/autoadmin/server/utils/form'
import type { ZodObject, ZodType } from 'zod'
import { useJsonAdminApiPrefix } from '#layers/autoadmin/composables/jsonAdmin'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'
import { dezerialize } from 'zodex'

const modelKey = (useRoute().params.modelKey as string).replace(/\/$/, '')
const jsonApi = useJsonAdminApiPrefix()
const listPath = { name: 'jsonadmin-array-list', params: { modelKey } } as const

const { data, error } = await useFetch<{ spec: FormSpec }>(`${jsonApi}/formspec/${modelKey}`, {
  key: `json-formspec-create-${modelKey}`,
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    statusMessage: error.value.statusMessage,
  })
}

const formSpec = data.value?.spec as FormSpec

if (!formSpec?.schema) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Form spec schema must be provided.',
  })
}

const schema = dezerialize(formSpec.schema) as ZodObject<Record<string, ZodType>>
const endpoint = formSpec.endpoint
if (!endpoint) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Endpoint must be provided.',
  })
}

useHead({
  title: `${formSpec.listTitle} > Create | Configuration | ${getAdminTitle()}`,
})
</script>

<template>
  <AutoAdmin>
    <div class="flex items-center mb-6">
      <UTooltip :text="`Back to ${formSpec.listTitle}`">
        <UButton
          class="mr-1"
          color="neutral"
          variant="ghost"
          :to="listPath"
        >
          <UIcon name="i-lucide-chevron-left" />
        </UButton>
      </UTooltip>
      <h1 class="text-3xl font-bold">
        Create New
      </h1>
    </div>

    <AutoForm
      v-if="formSpec"
      class="space-y-4"
      mode="create"
      :endpoint="endpoint"
      :redirect-path="listPath"
      :schema="schema"
      :spec="formSpec"
    />
  </AutoAdmin>
</template>
