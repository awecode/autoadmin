<script setup lang="ts">
import type { ZodObject, ZodType } from 'zod'
import { toTitleCase } from '#layers/autoadmin/utils/string'
import { dezerialize } from 'zodex'

const props = defineProps<{
  modelKey: string
  mode: 'create' | 'update'
  lookupValue?: string | number
  onSave: (data: Record<string, any>) => void
}>()

const modelKey = props.modelKey
const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix

const fetchEndpoint = props.mode === 'create' ? `${apiPrefix}/formspec/${modelKey}` : `${apiPrefix}/formspec/${modelKey}/update/${props.lookupValue}`
const data = await $fetch<{ spec: FormSpec, values?: Record<string, any> }>(fetchEndpoint)
const formSpec = data.spec

if (!formSpec.schema) {
  throw createError({
    statusCode: 500,
    statusMessage: `Form spec schema must be provided.`,
  })
}

const listTitle = formSpec.listTitle || toTitleCase(modelKey)

const schema = dezerialize(formSpec.schema) as ZodObject<Record<string, ZodType>>
const values = props.mode === 'create' ? {} : data.values

const endpoint = data.spec.endpoint
if (!endpoint) {
  throw createError({
    statusCode: 500,
    statusMessage: `Endpoint must be provided.`,
  })
}

const title = props.mode === 'create' ? `${listTitle} > Create` : `${listTitle} > Update ${formSpec.labelString ?? props.lookupValue}`
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
