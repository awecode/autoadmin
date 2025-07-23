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

describe('list', async () => {
  it('should have correct page title', async () => {
    const page = await createPage()
    await page.goto(url('/admin/tags'))
    const pageTitle = await page.title()
    expect(pageTitle).toContain('Tags')
  })
  it('should open create page', async () => {
    const page = await createPage()
    await page.goto(url('/admin/tags'))
    const createButton = await page.$('span:has-text("Add")')
    expect(createButton).toBeDefined()
    await createButton?.click()
    const pageTitle = await page.title()
    expect(pageTitle).toContain('Tag')
    expect(pageTitle).toContain('Create')
    const pagePath = await page.url()
    expect(pagePath).toContain('/admin/tags/create')
  })
})

describe('create', async () => {
  it('should submit form', async () => {
    const page = await createPage()
    await page.goto(url('/admin/tags/create'), { waitUntil: 'hydration' })
    const submitButton = await page.$('button:has-text("Create")')
    expect(submitButton).toBeTruthy()
    await submitButton?.click()

    // should not submit because of validation errors
    const pagePath2 = await page.url()
    expect(pagePath2).toBe(url('/admin/tags/create'))

    // set name to "Tag 1"
    const nameInput = await page.$('input[name="name"]')
    expect(nameInput).toBeTruthy()
    await nameInput?.fill('Tag 1')
    await nameInput?.focus()
    await page.keyboard.press('Tab')
    await submitButton?.click()
  }, 50000)
})
