<script setup lang="ts">
import { getAdminTitle } from '#layers/autoadmin/utils/autoadmin'

useHead({
  title: `Dashboard | ${getAdminTitle()}`,
})
</script>

<template>
  <AutoAdmin>
    <EntityGrid />
  </AutoAdmin>
</template>
