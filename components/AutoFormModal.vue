<script setup lang="ts">
const props = defineProps<{
  modelKey: string
  mode: 'create' | 'update'
  lookupValue?: string | number
  onSave: (data: Record<string, any>) => void
}>()

const modelKey = props.modelKey
const cfg = useAdminRegistry().get(modelKey)

if (!cfg) {
  throw createError({
    statusCode: 404,
    statusMessage: `Model "${modelKey}" is not registered.`,
  })
}

const apiPrefix = cfg.apiPrefix

const fetchEndpoint = props.mode === 'create' ? `${apiPrefix}/formspec/${modelKey}` : `${apiPrefix}/formspec/${modelKey}/update/${props.lookupValue}`
const data = await $fetch<{ spec: FormSpec, values?: Record<string, any> }>(fetchEndpoint)
const formSpec = data.spec
const schema = props.mode === 'create' ? cfg.create.schema : cfg.update.schema
const values = props.mode === 'create' ? {} : data.values

const endpoint = props.mode === 'create' ? (cfg.create.endpoint ?? `${apiPrefix}/${modelKey}`) : (cfg.update.endpoint ?? `${apiPrefix}/${modelKey}/${props.lookupValue}`)

const title = props.mode === 'create' ? `${cfg.list.title ?? cfg.label} > Create` : `${cfg.list.title ?? cfg.label} > Update ${formSpec.labelString ?? props.lookupValue}`
</script>

<template>
  <UModal class="max-w-2xl overflow-y-auto border border-gray-500 rounded-lg p-8" :description="title" :title="title">
    <template #content>
      <div class="text-lg font-bold mb-8">
        {{ title }}
      </div>
      <AutoForm
        v-if="formSpec"
        class=""
        :endpoint="endpoint"
        :mode="mode"
        :schema="schema"
        :spec="formSpec"
        :values="values"
        @save="onSave"
      />
    </template>
  </UModal>
</template>
