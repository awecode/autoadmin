<script setup lang="ts">
import type { FormSpec } from '~/utils/form'

defineProps<{
  field: FormSpec['fields'][number]
  state: Record<string, any>
}>()
</script>

<template>
  <UFormField v-if="field.type === 'select'" :label="field.label" :name="field.name">
    <USelect v-model="state[field.name]" class="w-full" :items="field.enumValues" />
  </UFormField>
  <UFormField v-else :label="field.label" :name="field.name">
    <UInput v-model="state[field.name]" :type="field.type" />
  </UFormField>
</template>
