<script setup lang="ts">
const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')
const cfg = useAdminRegistry().get(modelLabel)

if (!cfg) {
  throw createError({
    statusCode: 404,
    statusMessage: `Model ${modelLabel} not registered.`,
  })
}

const listEndpoint = cfg.list?.endpoint ?? `${apiPrefix}/${modelLabel}`
const updatePage = cfg.update?.enabled ? { name: 'autoadmin-update', params: { modelLabel: `${modelLabel}` } } : undefined
const deleteEndpoint = cfg.delete?.enabled ? (cfg.delete?.endpoint ?? `${apiPrefix}/${modelLabel}`) : undefined
const listTitle = cfg.list?.title ?? useTitleCase(cfg.label ?? modelLabel)
const columns = cfg.list?.columns ?? undefined
const lookupColumnName = cfg.lookupColumnName

const actions = [
  {
    label: 'Add',
    to: { name: 'autoadmin-create', params: { modelLabel: `${modelLabel}` } },
  },
]

useHead({
  title: `${listTitle}`,
})
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- <div>Columns: {{ columns }}</div>
    <div>Type: {{ typeof columns }}</div> -->
    <DataTable
      :actions="actions"
      :columns="columns"
      :delete-endpoint="deleteEndpoint"
      :endpoint="listEndpoint"
      :lookup-column-name="lookupColumnName"
      :title="listTitle"
      :update-page="updatePage"
    />
  </div>
</template>
