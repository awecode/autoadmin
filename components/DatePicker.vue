<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

type DateDef = Date | string | undefined

const props = defineProps<{
  modelValue?: DateDef
  mode?: 'date' | 'string'
  placeholder?: string
  buttonVariant?: 'soft' | 'solid' | 'outline' | 'ghost' | 'link' | 'subtle'
}>()

const emit = defineEmits<{
  'update:modelValue': [DateDef]
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

const uCalendarValue: Ref<CalendarDate | undefined> = shallowRef(undefined)

const syncFromModelValue = (modelValue: typeof props.modelValue) => {
  if (typeof modelValue === 'string' && modelValue !== '') {
    const dateParts = modelValue.split('-').map(Number)
    if (dateParts.length === 3) {
      uCalendarValue.value = new CalendarDate(dateParts[0]!, dateParts[1]!, dateParts[2]!)
    } else {
      uCalendarValue.value = undefined
    }
  } else if (modelValue instanceof Date) {
    uCalendarValue.value = new CalendarDate(
      modelValue.getFullYear(),
      modelValue.getMonth() + 1,
      modelValue.getDate(),
    )
  } else {
    uCalendarValue.value = undefined
  }
}

// Initialize with the initial modelValue
syncFromModelValue(props.modelValue)

const formatValue = (value: CalendarDate | undefined): DateDef => {
  if (!value) {
    return undefined
  }
  if (dateMode === 'string') {
    const d = value.toDate(getLocalTimeZone())
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return value.toDate(getLocalTimeZone())
}

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

// Flag to prevent infinite recursion, or does Vue handle this?
let isUpdatingFromParent = false

watch(uCalendarValue, (value) => {
  if (!isUpdatingFromParent) {
    emit('update:modelValue', formatValue(value))
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
  <UPopover>
    <UButton
      color="neutral"
      trailing-icon="i-lucide-calendar"
      :ui="{
        trailingIcon: 'text-dimmed ml-1',
      }"
      :variant="buttonVariant || 'outline'"
    >
      <template v-if="uCalendarValue">
        {{ df.format(uCalendarValue.toDate(getLocalTimeZone())) }}
      </template>
      <template v-else>
        <span class="text-sm text-dimmed">{{ placeholder || 'Pick a date' }}</span>
      </template>
    </UButton>

    <template #content>
      <UCalendar
        v-model="uCalendarValue"
        class="p-2"
      />
    </template>
  </UPopover>
</template>
