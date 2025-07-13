<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

const props = defineProps<{
  modelValue?: {
    start: Date
    end: Date
  } | `${string},${string}`
  mode?: 'date' | 'string'
}>()

const emit = defineEmits<{
  'update:modelValue': [{
    start: Date
    end: Date
  } | `${string},${string}`]
}>()

const defaultMode = 'string' as const

let dateMode: 'date' | 'string'

if (props.mode) {
  dateMode = props.mode
} else if (typeof props.modelValue === 'string') {
  dateMode = 'string'
} else if (typeof props.modelValue === 'object') {
  dateMode = 'date'
} else {
  dateMode = defaultMode
}

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

const uCalendarValue = shallowRef({
  start: new CalendarDate(2022, 1, 20),
  end: new CalendarDate(2022, 2, 10),
})

const formatDate = (date: CalendarDate) => {
  if (dateMode === 'string') {
    const d = date.toDate(getLocalTimeZone())
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return date.toDate(getLocalTimeZone())
}

const formatRange = (value: { start: CalendarDate, end: CalendarDate }) => {
  if (dateMode === 'string') {
    return `${formatDate(value.start)},${formatDate(value.end)}` as `${string},${string}`
  }
  return {
    start: formatDate(value.start) as Date,
    end: formatDate(value.end) as Date,
  }
}

watch(uCalendarValue, (value) => {
  emit('update:modelValue', formatRange(value))
})
</script>

<template>
  <UPopover>
    <UButton color="neutral" icon="i-lucide-calendar" variant="subtle">
      <template v-if="uCalendarValue.start">
        <template v-if="uCalendarValue.end">
          {{ df.format(uCalendarValue.start.toDate(getLocalTimeZone())) }} - {{ df.format(uCalendarValue.end.toDate(getLocalTimeZone())) }}
        </template>

        <template v-else>
          {{ df.format(uCalendarValue.start.toDate(getLocalTimeZone())) }}
        </template>
      </template>
      <template v-else>
        Pick a date
      </template>
    </UButton>

    <template #content>
      <UCalendar
        v-model="uCalendarValue"
        range
        class="p-2"
      />
    </template>
  </UPopover>
</template>
