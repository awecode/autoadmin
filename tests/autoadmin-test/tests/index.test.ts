import { $fetch, createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

await setup({
  host: 'http://localhost:3000',
})

describe('index', async () => {
  it('should use custom title', async () => {
    const html = await $fetch('/admin/')
    expect(html).toContain('Autoadmin Example')
  })
  it('should list all models', async () => {
    const page = await createPage()
    await page.goto(url('/admin/'), { waitUntil: 'hydration' })
    // there must be 4 spans with text: Categories, Users, Posts, Tags
    const spans = await page.$$('span')
    const spanTexts = await Promise.all(spans.map((span: { textContent: () => any }) => span.textContent()))
    expect(spans.length).toBeGreaterThanOrEqual(4)
    expect(spanTexts).toContain('Categories')
    expect(spanTexts).toContain('Users')
    expect(spanTexts).toContain('Posts')
    expect(spanTexts).toContain('Tags')
  })
})
