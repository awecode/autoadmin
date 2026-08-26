<script setup lang="ts">
import type { AuditLogEntry } from '#layers/autoadmin/utils/auditLogViewer'
import { auditChangeFieldKeys, formatAuditValue } from '#layers/autoadmin/utils/auditLogViewer'
import { humanifyDateTime } from '#layers/autoadmin/utils/date'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { computed } from 'vue'

const props = defineProps<{
  entry: AuditLogEntry
  /** Registered admin label for `entry.modelKey` when known. */
  modelLabel?: string
}>()

const actionLabel = computed(() => toTitleCase(props.entry.action.replace(/\./g, ' ')))
const displayModelLabel = computed(() => props.modelLabel || props.entry.modelKey)

const actionColor = computed(() => {
  switch (props.entry.action) {
    case 'create':
      return 'success'
    case 'update':
      return 'info'
    case 'delete':
    case 'bulkDelete':
      return 'error'
    case 'relation.m2m':
    case 'relation.o2m':
      return 'warning'
    default:
      return 'neutral'
  }
})

const createdLabel = computed(() => {
  const raw = props.entry.createdAt
  if (raw == null) {
    return '—'
  }
  if (raw instanceof Date) {
    return humanifyDateTime(raw)
  }
  if (typeof raw === 'number') {
    return humanifyDateTime(new Date(raw))
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return humanifyDateTime(parsed)
  }
  return String(raw)
})

const actorLine = computed(() => {
  const parts = [
    props.entry.actorLabel,
    props.entry.actorRole,
    props.entry.actorId,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
})

const diffKeys = computed(() => auditChangeFieldKeys(props.entry.changes))

const snapshot = computed(() => {
  const action = props.entry.action
  if (action === 'create') {
    return { label: 'Created values', record: props.entry.changes?.after }
  }
  if (action === 'delete') {
    return { label: 'Deleted values', record: props.entry.changes?.before }
  }
  return null
})

const snapshotKeys = computed(() => {
  const record = snapshot.value?.record
  if (!record) {
    return []
  }
  return Object.keys(record).sort()
})

const relationMeta = computed(() => {
  const meta = props.entry.meta
  if (!meta) {
    return null
  }
  if (props.entry.action !== 'relation.m2m' && props.entry.action !== 'relation.o2m') {
    return null
  }
  return {
    field: meta.field,
    added: meta.added,
    removed: meta.removed,
  }
})

const bulkLookupValues = computed(() => {
  if (props.entry.action !== 'bulkDelete') {
    return null
  }
  const values = props.entry.meta?.lookupValues
  return Array.isArray(values) ? values : null
})

const leftoverMeta = computed(() => {
  const meta = props.entry.meta
  if (!meta || !Object.keys(meta).length) {
    return null
  }
  if (relationMeta.value || bulkLookupValues.value) {
    return null
  }
  return meta
})
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-start gap-3">
      <UBadge
        :color="actionColor"
        variant="subtle"
        size="lg"
        class="font-mono"
      >
        {{ actionLabel }}
      </UBadge>
      <div class="min-w-0 space-y-1">
        <p class="text-lg font-semibold text-highlighted">
          {{ displayModelLabel }}
          <span
            v-if="entry.lookupValue != null && entry.lookupValue !== ''"
            class="text-muted font-normal"
          >
            · {{ entry.lookupValue }}
          </span>
        </p>
        <p class="text-sm text-muted">
          {{ createdLabel }}
        </p>
        <p class="text-sm text-muted">
          Actor: {{ actorLine }}
        </p>
      </div>
    </div>

    <section
      v-if="entry.action === 'update' && diffKeys.length"
      class="space-y-3"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        Changed fields
      </h2>
      <div class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left">
            <tr>
              <th class="px-3 py-2 font-medium">
                Field
              </th>
              <th class="px-3 py-2 font-medium">
                Before
              </th>
              <th class="px-3 py-2 font-medium">
                After
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="key in diffKeys"
              :key="key"
              class="border-t border-default align-top"
            >
              <td class="px-3 py-2 font-mono text-xs whitespace-nowrap">
                {{ key }}
              </td>
              <td class="px-3 py-2">
                <pre class="whitespace-pre-wrap break-words font-mono text-xs text-muted">{{ formatAuditValue(entry.changes?.before?.[key]) }}</pre>
              </td>
              <td class="px-3 py-2 bg-primary/5">
                <pre class="whitespace-pre-wrap break-words font-mono text-xs">{{ formatAuditValue(entry.changes?.after?.[key]) }}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-else-if="snapshot && snapshotKeys.length"
      class="space-y-3"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        {{ snapshot.label }}
      </h2>
      <div class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <tbody>
            <tr
              v-for="key in snapshotKeys"
              :key="key"
              class="border-t border-default first:border-t-0 align-top"
            >
              <td class="px-3 py-2 font-mono text-xs whitespace-nowrap w-40 bg-elevated">
                {{ key }}
              </td>
              <td class="px-3 py-2">
                <pre class="whitespace-pre-wrap break-words font-mono text-xs">{{ formatAuditValue(snapshot.record?.[key]) }}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="relationMeta"
      class="space-y-3"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        Relation change
      </h2>
      <dl class="grid gap-3 sm:grid-cols-3 text-sm">
        <div class="rounded-lg border border-default p-3">
          <dt class="text-muted text-xs uppercase">
            Field
          </dt>
          <dd class="mt-1 font-mono">
            {{ formatAuditValue(relationMeta.field) }}
          </dd>
        </div>
        <div class="rounded-lg border border-default p-3">
          <dt class="text-muted text-xs uppercase">
            Added
          </dt>
          <dd class="mt-1">
            <pre class="whitespace-pre-wrap break-words font-mono text-xs">{{ formatAuditValue(relationMeta.added) }}</pre>
          </dd>
        </div>
        <div class="rounded-lg border border-default p-3">
          <dt class="text-muted text-xs uppercase">
            Removed
          </dt>
          <dd class="mt-1">
            <pre class="whitespace-pre-wrap break-words font-mono text-xs">{{ formatAuditValue(relationMeta.removed) }}</pre>
          </dd>
        </div>
      </dl>
    </section>

    <section
      v-if="bulkLookupValues"
      class="space-y-3"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        Bulk deleted lookups
      </h2>
      <pre class="rounded-lg border border-default p-3 font-mono text-xs whitespace-pre-wrap">{{ formatAuditValue(bulkLookupValues) }}</pre>
    </section>

    <section
      v-if="leftoverMeta"
      class="space-y-3"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
        Meta
      </h2>
      <pre class="rounded-lg border border-default p-3 font-mono text-xs whitespace-pre-wrap">{{ formatAuditValue(leftoverMeta) }}</pre>
    </section>
  </div>
</template>
