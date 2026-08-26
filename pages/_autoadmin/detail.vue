<script setup lang="ts">
import type { AuditLogEntry } from '#layers/autoadmin/utils/auditLogViewer'
import AuditLogViewer from '#layers/autoadmin/components/AuditLogViewer.vue'
import { formatAuditValue, isAuditLogEntry } from '#layers/autoadmin/utils/auditLogViewer'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { computed } from 'vue'

const route = useRoute()
const modelKey = (route.params.modelKey as string).replace(/\/$/, '')
const lookupValue = (route.params.lookupValue as string).replace(/\/$/, '')
const config = useRuntimeConfig()
const apiPrefix = config.public.autoadmin.apiPrefix
const adminTitle = computed(() => String(config.public.autoadmin?.title || 'AutoAdmin'))

const { data, error } = await useFetch<Record<string, unknown>>(`${apiPrefix}/${modelKey}/${lookupValue}`, {
  key: `autoadmin-detail-${modelKey}-${lookupValue}`,
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode,
    statusMessage: error.value.statusMessage,
  })
}

const row = computed(() => data.value ?? {})
const auditEntry = computed(() => {
  if (isAuditLogEntry(row.value)) {
    return row.value as AuditLogEntry
  }
  return null
})

const listTitle = computed(() => {
  if (auditEntry.value) {
    return 'Audit Logs'
  }
  return toTitleCase(modelKey)
})

const heading = computed(() => {
  if (auditEntry.value) {
    return `${auditEntry.value.action} · ${auditEntry.value.modelKey}`
  }
  return String(row.value.id ?? lookupValue)
})

const fallbackKeys = computed(() => Object.keys(row.value).sort())

const listPath = { name: 'autoadmin-list', params: { modelKey } } as const

useHead({
  title: computed(() => `${heading.value} | ${listTitle.value} | ${adminTitle.value}`),
})
</script>

<template>
  <AutoAdmin>
    <div class="flex items-center mb-6">
      <UTooltip :text="`Back to ${listTitle}`">
        <UButton
          class="mr-1"
          color="neutral"
          variant="ghost"
          :to="listPath"
        >
          <UIcon name="i-lucide-chevron-left" />
        </UButton>
      </UTooltip>

      <h1 class="text-3xl font-bold truncate">
        {{ heading }}
      </h1>
    </div>

    <AuditLogViewer
      v-if="auditEntry"
      :entry="auditEntry"
    />

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <table class="w-full text-sm">
        <tbody>
          <tr
            v-for="key in fallbackKeys"
            :key="key"
            class="border-t border-default first:border-t-0 align-top"
          >
            <td class="px-3 py-2 font-mono text-xs whitespace-nowrap w-40 bg-elevated">
              {{ key }}
            </td>
            <td class="px-3 py-2">
              <pre class="whitespace-pre-wrap wrap-break-word font-mono text-xs">{{ formatAuditValue(row[key]) }}</pre>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AutoAdmin>
</template>
