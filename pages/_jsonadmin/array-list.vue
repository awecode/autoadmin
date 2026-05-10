<script setup lang="ts">
import { useJsonAdminApiPrefix } from '#layers/autoadmin/composables/jsonAdmin'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'

const modelKey = (useRoute().params.modelKey as string).replace(/\/$/, '')
const jsonApi = useJsonAdminApiPrefix()

useHead({
  title: `${modelKey} | Configuration | ${getAdminTitle()}`,
})
</script>

<template>
  <AutoAdmin>
    <DataTable
      :list-api-base-override="jsonApi"
      :back-path="{ name: 'jsonadmin-index' }"
      back-text="Back to Configuration"
      list-route-name="jsonadmin-array-list"
    />
  </AutoAdmin>
</template>
