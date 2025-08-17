<script setup lang="ts">
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'

const modelKey = (useRoute().params.modelKey as string).replace(/\/$/, '')
const cfg = useAdminRegistry().get(modelKey)
if (!cfg) {
  throw createError({
    statusCode: 404,
    statusMessage: `Model "${modelKey}" is not registered.`,
  })
}

const apiPrefix = cfg.apiPrefix

const listTitle = cfg.list?.title ?? cfg.label
const listPath = { name: 'autoadmin-list', params: { modelKey } }
const lookupValue = (useRoute().params.lookupValue as string).replace(/\/$/, '')

const { data, error } = await useFetch<{ spec: FormSpec, values?: Record<string, any> }>(`${apiPrefix}/formspec/${modelKey}/update/${lookupValue}`, {
  key: `formspec-update-${modelKey}-${lookupValue}`,
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    statusMessage: error.value.statusMessage,
  })
}
const formSpec = data.value?.spec as FormSpec
const values = data.value?.values as Record<string, any>
const schema = cfg.update.schema

const endpoint = cfg.update.endpoint ?? `${apiPrefix}/${modelKey}/${lookupValue}`

useHead({
  title: `${listTitle} > Update ${formSpec.labelString ?? lookupValue} | ${getAdminTitle()}`,
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
        Update {{ formSpec.labelString ?? lookupValue }}
      </h1>
    </div>

    <AutoForm
      v-if="formSpec"
      class="space-y-4 p-6 rounded-lg bg-gray-100 dark:bg-gray-800"
      mode="update"
      :endpoint="endpoint"
      :redirect-path="listPath"
      :schema="schema"
      :spec="formSpec"
      :values="values"
    />
  </AutoAdmin>
</template>
