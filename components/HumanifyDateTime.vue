<script setup lang="ts">
import { humanifyDateTime } from '#layers/autoadmin/utils/date'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: string | Date | number | null | undefined
  includeTime?: boolean
}>(), {
  includeTime: true,
})

const datetime = computed(() => {
  if (props.value == null || props.value === '') {
    return null
  }
  const date = props.value instanceof Date ? props.value : new Date(props.value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
})

const rawTitle = computed(() => datetime.value?.toISOString() ?? '')

const label = computed(() => {
  if (!datetime.value) {
    return ''
  }
  return humanifyDateTime(datetime.value, { includeTime: props.includeTime })
})

const invalidFallback = computed(() => {
  if (props.value == null || props.value === '' || datetime.value != null) {
    return ''
  }
  return String(props.value)
})
</script>

<template>
  <span
    v-if="datetime"
    data-allow-mismatch="text"
    :title="rawTitle"
  >{{ label }}</span>
  <span
    v-else-if="invalidFallback"
    :title="invalidFallback"
  >{{ invalidFallback }}</span>
</template>
