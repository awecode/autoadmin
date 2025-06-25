<template>
    <div class="container mx-auto px-4 py-8">
        {{ modelLabel }}x
        <DataTable endpoint="/api/platforms" delete-endpoint="/api/platforms" title="Platforms" :columns="columns"
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