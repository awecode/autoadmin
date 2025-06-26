<script setup lang="ts">
import { createInsertSchema } from 'drizzle-zod'

const config = useRuntimeConfig()
const apiPrefix = config.public.apiPrefix
const modelLabel = (useRoute().params.modelLabel as string).replace(/\/$/, '')
const cfg = useAdminRegistry().get(modelLabel)
if (!cfg) {
  throw createError({
    statusCode: 404,
    statusMessage: `Model ${modelLabel} not registered.`,
  })
}
const model = cfg.model
const insertSchema = createInsertSchema(model)

const listTitle = cfg.list?.title ?? useTitleCase(cfg.label ?? modelLabel)

const router = useRouter()
console.log(insertSchema)
const formSpec = zodToFormSpec(insertSchema)

const form = ref<{ [key: string]: any }>({})

const loading = ref(false)

const createEndpoint = cfg.create?.endpoint ?? `${apiPrefix}/${modelLabel}`

// Fetch locations for dropdown
// const { data: locationsData } = await useFetch('/api/locations')
// const locations = computed(() => locationsData.value?.data || [])

const performCreate = async () => {
  loading.value = true
  try {
    const response = await $fetch<{ success: boolean }>(createEndpoint, {
      method: 'POST',
      body: form.value,
    })

    if (response.success) {
      await router.push({ name: 'autoadmin-list', params: { modelLabel: `${modelLabel}` } })
    }
  } catch (error) {
    alert(`Failed to create: ${error.message}`)
  } finally {
    loading.value = false
  }
}

useHead({
  title: `${listTitle} > Create`,
})
</script>

<template>
  <!-- {{ insertSchema }} -->
  <div>=============================</div>
  {{ formSpec }}
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center mb-6">
        <NuxtLink
          class="mr-4 text-gray-500 hover:text-gray-700"
          :to="{ name: 'autoadmin-list', params: { modelLabel: `${modelLabel}` } }"
        >
          ← Back to {{ listTitle }}
        </NuxtLink>
        <h1 class="text-3xl font-bold">
          Create New
        </h1>
      </div>

      <AutoForm :spec="formSpec" />

      <form class="bg-white shadow-md rounded px-8 pt-6 pb-8" @submit.prevent="performCreate">
        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="name">
            Platform Name *
          </label>
          <input
            id="name"
            v-model="form.name"
            required
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="e.g., Hetzner, DigitalOcean, AWS"
            type="text"
          />
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="icon">
            Icon
          </label>
          <input
            id="icon"
            v-model="form.icon"
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Icon identifier, emoji, or URL"
            type="text"
          />
          <p class="text-gray-600 text-xs mt-1">
            Optional: An icon or emoji to represent this platform
          </p>
        </div>

        <!-- <div class="mb-6">
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="preferredLocationId">
                        Preferred Location
                    </label>
                    <select id="preferredLocationId" v-model="form.preferredLocationId"
                        class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                        <option value="">No preference</option>
                        <option v-for="location in locations" :key="location.id" :value="location.id">
                            {{ location.name }} - {{ location.country }}
                        </option>
                    </select>
                    <p class="text-gray-600 text-xs mt-1">Optional: Default location for this platform</p>
                </div> -->

        <div class="flex items-center justify-between">
          <button
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
            type="submit"
            :disabled="loading"
          >
            {{ loading ? 'Creating...' : 'Create' }}
          </button>
          <NuxtLink
            class="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
            :to="{ name: 'autoadmin-list', params: { modelLabel: `${modelLabel}` } }"
          >
            Cancel
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>
