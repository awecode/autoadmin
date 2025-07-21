import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, it } from 'vitest'

await setup({
  host: 'http://localhost:3000',
})

describe('index page', async () => {
  it('index page', async () => {
    await $fetch('/admin')
  })
})
