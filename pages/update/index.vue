<script setup lang="ts">
const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')
const cfg = useAdminRegistry().get(modelLabel)
if (!cfg) {
  throw createError({
    statusCode: 404,
    statusMessage: `Model ${modelLabel} not registered.`,
  })
}

const listTitle = cfg.list?.title ?? useTitleCase(cfg.label ?? modelLabel)
const listPath = { name: 'autoadmin-list', params: { modelLabel: `${modelLabel}` } }
const lookupValue = (useRoute().params.lookupValue as string).replace(/\/$/, '')

const { data } = await useFetch(`/api/autoadmin/formspec/${modelLabel}/update/${lookupValue}`, {
  key: `formspec-update-${modelLabel}-${lookupValue}`,
})
const formSpec = data.value?.spec as FormSpec
const values = data.value?.values as Record<string, any>
const schema = cfg.update.schema

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const endpoint = cfg.update.endpoint ?? `${apiPrefix}/${modelLabel}/${lookupValue}`

useHead({
  title: `${listTitle} > Update`,
})
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center mb-6">
        <NuxtLink
          class="mr-4 text-gray-500 hover:text-gray-700"
          :to="listPath"
        >
          ← Back to {{ listTitle }}
        </NuxtLink>
        <h1 class="text-3xl font-bold">
          Update {{ lookupValue }}
        </h1>
      </div>

      <AutoForm
        v-if="formSpec"
        mode="update"
        :endpoint="endpoint"
        :redirect-path="listPath"
        :schema="schema"
        :spec="formSpec"
        :values="values"
      />
    </div>
  </div>
</template>
