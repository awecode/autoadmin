<script setup lang="ts">
import type { FormSpec } from '#layers/autoadmin/server/utils/form'
import type { RouteLocationRaw } from 'vue-router'
import type { ZodObject, ZodType } from 'zod'
import { useJsonAdminApiPrefix } from '#layers/autoadmin/composables/jsonAdmin'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'
import { dezerialize } from 'zodex'

const route = useRoute()
const modelKey = (route.params.modelKey as string).replace(/\/$/, '')
const jsonApi = useJsonAdminApiPrefix()
const returnTo = route.query.returnTo
const redirectPath: RouteLocationRaw = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')
  ? returnTo
  : { name: 'jsonadmin-array-list', params: { modelKey } }
const lookupValue = (route.params.lookupValue as string).replace(/\/$/, '')

const { data, error } = await useFetch<{ spec: FormSpec }>(`${jsonApi}/formspec/${modelKey}/update/${encodeURIComponent(lookupValue)}`, {
  key: `json-formspec-update-${modelKey}-${lookupValue}`,
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
  title: `${formSpec.listTitle} > Update ${formSpec.labelString ?? lookupValue} | Configuration | ${getAdminTitle()}`,
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
          :to="redirectPath"
        >
          <UIcon name="i-lucide-chevron-left" />
        </UButton>
      </UTooltip>

      <h1 class="text-3xl font-bold">
        Update {{ formSpec.labelString ?? lookupValue }}
      </h1>
    </div>

    <AutoForm
      v-if="formSpec"
      class="space-y-4"
      mode="update"
      :endpoint="endpoint"
      :redirect-path="redirectPath"
      :schema="schema"
      :spec="formSpec"
    />
  </AutoAdmin>
</template>
