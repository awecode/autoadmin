<script setup lang="ts">
import type { JsonAdminRegistryLink } from '#layers/autoadmin/utils/registryMeta'
import JsonAdminRegistryGrid from '#layers/autoadmin/components/JsonAdminRegistryGrid.vue'

const config = useRuntimeConfig()

const { data: links, error } = await useFetch<JsonAdminRegistryLink[]>('/api/autoadmin/json/registry-meta', {
  key: 'json-admin-registry-meta',
  headers: {
    referer: useRequestURL().pathname,
  },
})

if (error.value?.data?.data?.redirect) {
  navigateTo(error.value.data.data.redirect)
}

const linkLabel = computed(() => {
  const a = config.public.autoadmin as { jsonadmin?: { linkLabel?: string } } | undefined
  return a?.jsonadmin?.linkLabel ?? 'Configuration'
})

const adminTitle = getAdminTitle()

useHead({
  title: computed(() => `${linkLabel.value} | ${adminTitle}`),
})
</script>

<template>
  <AutoAdmin>
    <JsonAdminRegistryGrid
      :links="links"
      :page-title="linkLabel"
    />
  </AutoAdmin>
</template>
