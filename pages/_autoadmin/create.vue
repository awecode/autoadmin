<script setup lang="ts">
import type { ZodObject, ZodType } from 'zod'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { dezerialize } from 'zodex'

const modelKey = (useRoute().params.modelKey as string).replace(/\/$/, '')
const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix

const listPath = { name: 'autoadmin-list', params: { modelKey } }

const { data, error } = await useFetch<{ spec: FormSpec }>(`${apiPrefix}/formspec/${modelKey}`, {
  key: `formspec-${modelKey}`,
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    statusMessage: error.value.statusMessage,
  })
}

const formSpec = data.value?.spec as FormSpec

if (!formSpec.schema) {
  throw createError({
    statusCode: 500,
    statusMessage: `Form spec schema must be provided.`,
  })
}
const schema = dezerialize(formSpec.schema) as ZodObject<Record<string, ZodType>>
const endpoint = formSpec.endpoint
if (!endpoint) {
  throw createError({
    statusCode: 500,
    statusMessage: `Endpoint must be provided.`,
  })
}

const listTitle = formSpec.listTitle || toTitleCase(modelKey)

useHead({
  title: `${listTitle} > Create | ${getAdminTitle()}`,
})
</script>

<template>
  <AutoAdmin>
    <div class="flex items-center mb-6">
      <UTooltip :text="`Back to ${listTitle}`">
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
      class="space-y-4 p-6 rounded-lg bg-gray-100 dark:bg-gray-800"
      mode="create"
      :endpoint="endpoint"
      :redirect-path="listPath"
      :schema="schema"
      :spec="formSpec"
    />
  </AutoAdmin>
</template>
