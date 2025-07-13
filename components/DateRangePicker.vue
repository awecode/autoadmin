<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

const props = defineProps<{
  modelValue?: {
    start: Date
    end: Date
  } | `${string},${string}` | ''
  mode?: 'date' | 'string'
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [{
    start: Date | undefined
    end: Date | undefined
  } | `${string},${string}` | '']
}>()

const defaultMode = 'string' as const

let dateMode: 'date' | 'string'

// Get or infer the date mode
if (props.mode) {
  dateMode = props.mode
} else if (typeof props.modelValue === 'string') {
  dateMode = 'string'
} else if (typeof props.modelValue === 'object') {
  dateMode = 'date'
} else {
  dateMode = defaultMode
}

const uCalendarValue: Ref<{ start: CalendarDate | undefined, end: CalendarDate | undefined }> = shallowRef({
  start: undefined,
  end: undefined,
})

const syncFromModelValue = (modelValue: typeof props.modelValue) => {
  if (typeof modelValue === 'string') {
    const [start, end] = modelValue.split(',')
    if (start && end) {
      const startSplits = start.split('-').map(Number)
      const endSplits = end.split('-').map(Number)
      uCalendarValue.value = {
        start: new CalendarDate(startSplits[0], startSplits[1], startSplits[2]),
        end: new CalendarDate(endSplits[0], endSplits[1], endSplits[2]),
      }
    } else {
      uCalendarValue.value = {
        start: undefined,
        end: undefined,
      }
    }
  } else if (modelValue) {
    const start = modelValue.start
    const end = modelValue.end
    if (start && end) {
      uCalendarValue.value = {
        start: new CalendarDate(start.getFullYear(), start.getMonth() + 1, start.getDate()),
        end: new CalendarDate(end.getFullYear(), end.getMonth() + 1, end.getDate()),
      }
    } else {
      uCalendarValue.value = {
        start: undefined,
        end: undefined,
      }
    }
  } else {
    uCalendarValue.value = {
      start: undefined,
      end: undefined,
    }
  }
}

// Initialize with the initial modelValue
syncFromModelValue(props.modelValue)

const formatDate = (date: CalendarDate) => {
  if (dateMode === 'string') {
    const d = date.toDate(getLocalTimeZone())
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return date.toDate(getLocalTimeZone())
}

const formatRange = (value: { start: CalendarDate | undefined, end: CalendarDate | undefined }) => {
  if (!value.start || !value.end) {
    return dateMode === 'string' ? '' : { start: undefined, end: undefined }
  }
  if (dateMode === 'string') {
    return `${formatDate(value.start)},${formatDate(value.end)}` as `${string},${string}`
  }
  return {
    start: formatDate(value.start) as Date,
    end: formatDate(value.end) as Date,
  }
}

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

// Flag to prevent infinite recursion, or does Vue handle this?
let isUpdatingFromParent = false

watch(uCalendarValue, (value) => {
  if (!isUpdatingFromParent) {
    emit('update:modelValue', formatRange(value))
  }
})

// Watch for external changes to modelValue and sync them to uCalendarValue
watch(() => props.modelValue, (newValue) => {
  isUpdatingFromParent = true
  syncFromModelValue(newValue)
  nextTick(() => {
    isUpdatingFromParent = false
  })
})
</script>

<template>
  {{ uCalendarValue }}
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
        {{ placeholder || 'Pick a date range' }}
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
