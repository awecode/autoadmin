<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  attrs: Record<string, any>
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div v-bind="attrs">
    {{ modelValue }}
  </div>
</template>
