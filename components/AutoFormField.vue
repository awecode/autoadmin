<script setup lang="ts">
import type { FormSpec } from '~/utils/form'

const props = defineProps<{
  field: FormSpec['fields'][number]
  state: Record<string, any>
}>()
</script>

<template>
  <UFormField :label="field.label" :name="field.name">
    <UInput v-model="state[field.name]" :type="field.type" />
  </UFormField>
</template>
