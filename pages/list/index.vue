<template>
    <div class="container mx-auto px-4 py-8">
        <DataTable :endpoint="listEndpoint" :delete-endpoint="deleteEndpoint" :title="listTitle" :columns="columns"
            :actions="actions">
        </DataTable>
    </div>
</template>

<script setup lang="ts">
const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')
const cfg = useNuxtApp().$adminRegistry.get(modelLabel)

const listEndpoint = cfg?.list?.endpoint ?? `/api/${modelLabel}`
const deleteEndpoint = cfg?.delete?.endpoint ?? `/api/${modelLabel}`
const listTitle = cfg?.list?.title ?? useTitleCase(cfg?.label ?? modelLabel)
if (!cfg) {
    throw createError({
        statusCode: 404,
        statusMessage: `Model ${modelLabel} not registered.`
    })
}

const columns = [
    {
        accessorKey: 'name',
        header: 'Platform Name'
    },
    {
        accessorKey: 'preferredLocationId',
        header: 'Preferred Location'
    }
]

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