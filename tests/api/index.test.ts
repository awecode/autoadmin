// @vitest-environment nuxt
import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

await setup({
  // host: 'http://localhost:3000',
  nuxtConfig: {
    plugins: ['#layers/autoadmin/tests/helpers/plugin.ts'],
    debug: true,
  },
})

describe('index page', async () => {
  it('index page', async () => {
    console.log('index page')
    const registry = useAdminRegistry()
    console.log(registry)
    try {
      const res = await $fetch('/admin')
      console.log(res)
    } catch (error: any) {
      console.log(error.stack)
      console.error('Fetch failed:', error?.response?._data || error)
      throw error
    }
  })
})
