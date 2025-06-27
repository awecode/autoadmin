<script setup lang="ts">
import { createInsertSchema } from 'drizzle-zod'

const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')
const cfg = useAdminRegistry().get(modelLabel)
if (!cfg) {
  throw createError({
    statusCode: 404,
    statusMessage: `Model ${modelLabel} not registered.`,
  })
}
const model = cfg.model
const insertSchema = createInsertSchema(model)

const listTitle = cfg.list?.title ?? useTitleCase(cfg.label ?? modelLabel)
const listPath = { name: 'autoadmin-list', params: { modelLabel: `${modelLabel}` } }

// Generate form spec with relations only once using useAsyncData
const { data: formSpec } = await useFetch(`/api/autoadmin/formspec/${modelLabel}`, {
  key: `formspec-${modelLabel}`,
})

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const createEndpoint = cfg.create?.endpoint ?? `${apiPrefix}/${modelLabel}`

useHead({
  title: `${listTitle} > Create`,
})
</script>

<template>
  <!-- {{ insertSchema }}
  <div>=============================</div>
  {{ formSpec }} -->
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
        :create-endpoint="createEndpoint"
        :redirect-path="listPath"
        :spec="formSpec"
      />
    </div>
  </div>
</template>
