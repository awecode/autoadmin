<template>
    <div class="container mx-auto px-4 py-8">
        <DataTable :endpoint="listEndpoint" :delete-endpoint="deleteEndpoint" :title="listTitle" :columns="columns"
            :actions="actions">
        </DataTable>
    </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')
const cfg = useAdminRegistry().get(modelLabel)

if (!cfg) {
    throw createError({
        statusCode: 404,
        statusMessage: `Model ${modelLabel} not registered.`
    })
}

const listEndpoint = cfg.list?.endpoint ?? `${apiPrefix}/${modelLabel}`
const deleteEndpoint = cfg.delete?.enabled ? (cfg.delete?.endpoint ?? `${apiPrefix}/${modelLabel}`) : undefined
const listTitle = cfg.list?.title ?? useTitleCase(cfg.label ?? modelLabel)
const columns = cfg.list?.columns ?? undefined

const actions = [
    {
        label: 'Add',
        to: `/${modelLabel}/new`,
    }
]

useHead({
    title: `${listTitle} - Ministage`
})
</script>