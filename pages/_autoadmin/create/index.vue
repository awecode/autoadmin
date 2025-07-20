<script setup lang="ts">
import { getTitle } from '~/utils/autoadmin'

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

const { data, error } = await useFetch(`/api/autoadmin/formspec/${modelLabel}`, {
  key: `formspec-${modelLabel}`,
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    statusMessage: error.value.statusMessage,
  })
}

const formSpec = data.value?.spec as FormSpec
const schema = cfg.create.schema

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const endpoint = cfg.create.endpoint ?? `${apiPrefix}/${modelLabel}`

useHead({
  title: `${listTitle} > Create | ${getTitle()}`,
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
          Create New
        </h1>
      </div>

      <AutoForm
        v-if="formSpec"
        class="space-y-4 p-10 rounded-lg bg-gray-50 dark:bg-gray-800"
        mode="create"
        :endpoint="endpoint"
        :redirect-path="listPath"
        :schema="schema"
        :spec="formSpec"
      />
    </div>
  </div>
</template>
