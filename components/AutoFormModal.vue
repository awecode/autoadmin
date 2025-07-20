<script setup lang="ts">
const props = defineProps<{
  modelLabel: string
  onSave: (data: Record<string, any>) => void
}>()

const emit = defineEmits<{close:[boolean]}>()

const modelLabel = props.modelLabel
const cfg = useAdminRegistry().get(modelLabel)

if (!cfg) {
  throw createError({
    statusCode: 404,
    statusMessage: `Model ${modelLabel} not registered.`,
  })
}

const data = await $fetch(`/api/autoadmin/formspec/${modelLabel}`)
const formSpec = data.spec as FormSpec
const schema = cfg.create.schema

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const endpoint = cfg.create.endpoint ?? `${apiPrefix}/${modelLabel}`
</script>

<template>
  <UModal>
    <template #content>
      <AutoForm
      class="border border-gray-500 rounded-lg"
        v-if="formSpec"
        mode="create"
        :endpoint="endpoint"
        :schema="schema"
        :spec="formSpec"
        @save="onSave"
      />
    </template>
  </UModal>
</template>
