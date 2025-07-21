import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

await setup({
  host: 'http://localhost:3000',
  nuxtConfig: {
    plugins: ['../helpers/plugin.ts'],
  },
})

describe('index page', async () => {
  it('index page', async () => {
    const registry = useAdminRegistry()
    console.log(registry)
    const response = await $fetch('/admin')
    expect(response).toBeDefined()
  })
})
