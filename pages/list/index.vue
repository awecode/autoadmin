<template>
    <div class="container mx-auto px-4 py-8">
        <DataTable :endpoint="listEndpoint" :delete-endpoint="deleteEndpoint" :title="listTitle" :columns="columns"
            :actions="actions">
            <template #actions-cell-prepend="{ row }">
                <UButton color="primary" icon="i-heroicons-pencil" variant="ghost"
                    :to="`/admin/categories/${row.original.id}`">
                    Edit
                </UButton>
            </template>
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
        id: 'name',
        accessorKey: 'name',
        header: 'Platform Name'
    },
    {
        id: 'preferredLocationId',
        accessorKey: 'preferredLocationId',
        header: 'Preferred Location'
    }
]

const actions = [
    {
        label: 'Add Platform',
        to: '/platforms/new',
    }
]

useHead({
    title: 'Platforms - Ministage'
})
</script>