<script setup lang="ts">
import type { JsonAdminRegistryLink } from '#layers/autoadmin/utils/jsonAdminRegistryMeta'
import JsonAdminRegistryGrid from '#layers/autoadmin/components/JsonAdminRegistryGrid.vue'
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'

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

const linkLabel = computed(() =>
  config.public.autoadmin?.jsonadmin?.linkLabel ?? 'Configuration',
)

const JSON_ADMIN_EMPTY_DOC = 'Register resources in a Nitro plugin with useJsonResourceRegistry().register(...). See docs/json-admin.md in the AutoAdmin package.'

useHead({
  title: computed(() => `${linkLabel.value} | ${getAdminTitle()}`),
})
</script>

<template>
  <AutoAdmin>
    <JsonAdminRegistryGrid
      :links="links"
      :page-title="linkLabel"
      :empty-description="JSON_ADMIN_EMPTY_DOC"
    />
  </AutoAdmin>
</template>
