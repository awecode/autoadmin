<script setup lang="ts">
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'
import { useJsonAdminApiPrefix } from '#layers/autoadmin/composables/jsonAdmin'

const modelKey = (useRoute().params.modelKey as string).replace(/\/$/, '')
const jsonApi = useJsonAdminApiPrefix()

useHead({
  title: `${modelKey} | Configuration | ${getAdminTitle()}`,
})
</script>

<template>
  <AutoAdmin>
    <div class="flex items-center gap-2 mb-6">
      <UTooltip text="Configuration home">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-left"
          :to="{ name: 'jsonadmin-index' }"
        />
      </UTooltip>
      <h1 class="text-2xl font-semibold capitalize">
        {{ modelKey }}
      </h1>
    </div>
    <DataTable
      :list-api-base-override="jsonApi"
      list-route-name="jsonadmin-array-list"
    />
  </AutoAdmin>
</template>
