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
    await page.goto(url('/admin/'), { waitUntil: 'domcontentloaded' })
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
})

describe('tags', async () => {
  it('should create tag', async () => {
    const page = await createPage()
    await page.goto(url('/admin/tags'), { waitUntil: 'hydration' })
    // Delete Tag 1 and Tag 2 if they exist
    for (const tagName of ['Tag 1', 'Tag 2']) {
      const deleteButton = await page.$(`tr:has(td:has-text("${tagName}")) button:has-text("Delete")`)
      if (deleteButton) {
        await deleteButton.click()
        // wait for dialog to open
        await page.waitForTimeout(1000)
        // find button with text Delete inside the dialog
        const confirmDelete = await page.$('[data-dismissable-layer] button:has-text("Delete")')
        expect(confirmDelete).toBeTruthy()
        if (confirmDelete) {
          await confirmDelete.click()
          // wait for deletion to complete
          await page.waitForTimeout(1000)
        }
      }
    }

    const createButton = await page.$('span:has-text("Add")')
    expect(createButton).toBeDefined()
    await createButton?.click()
    await page.waitForTimeout(1000)
    // Page must be ready by now, check title and url
    const pageTitle = await page.title()
    expect(pageTitle).toContain('Tag')
    expect(pageTitle).toContain('Create')
    const pagePath = await page.url()
    expect(pagePath).toBe(url('/admin/tags/create'))
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
    await page.keyboard.press('Tab')
    await submitButton?.click()

    await page.waitForTimeout(1000)
    const pagePath3 = await page.url()
    expect(pagePath3).toBe(url('/admin/tags'))

    // find tr with "Tag 1" text inside second td
    const tr = await page.$('tr:has(td:has-text("Tag 1"))')
    expect(tr).toBeTruthy()
  }, 50000)

  it('should update tag', async () => {
    const page = await createPage()
    await page.goto(url('/admin/tags'), { waitUntil: 'hydration' })
    // find tr with "Tag 1" text inside second td
    const tr = await page.$('tr:has(td:has-text("Tag 1"))')
    expect(tr).toBeTruthy()
    // find button with text Edit inside a td of a tr that has "Tag 1" text inside second td of the same tr
    const editButton = await page.$('tr:has(td:has-text("Tag 1")) button:has-text("Edit")')
    expect(editButton).toBeTruthy()
    await editButton?.click()
    await page.waitForTimeout(1000)
    const pageTitle = await page.title()
    expect(pageTitle).toContain('Tag')
    expect(pageTitle).toContain('Update')
    const nameInput = await page.$('input[name="name"]')
    expect(nameInput).toBeTruthy()
    await nameInput?.fill('Tag 2')
    await page.keyboard.press('Tab')
    const submitButton = await page.$('button:has-text("Update")')
    expect(submitButton).toBeTruthy()
    await submitButton?.click()

    await page.waitForTimeout(1000)
    const pagePath3 = await page.url()
    expect(pagePath3).toBe(url('/admin/tags'))

    // find tr with "Tag 2" text inside second td
    const tr2 = await page.$('tr:has(td:has-text("Tag 2"))')
    expect(tr2).toBeTruthy()
  })
})

describe('users', async () => {
  it('should create user', async () => {
    const page = await createPage()
    await page.goto(url('/admin/users'), { waitUntil: 'hydration' })
    // Delete User 1 if it exists
    const deleteButton = await page.$('tr:has(td:has-text("User 1")) button:has-text("Delete")')
    if (deleteButton) {
      await deleteButton.click()
      await page.waitForTimeout(1000)
      const confirmDelete = await page.$('[data-dismissable-layer] button:has-text("Delete")')
      expect(confirmDelete).toBeTruthy()
      if (confirmDelete) {
        await confirmDelete.click()
        await page.waitForTimeout(1000)
      }
    }
    const addButton = await page.$('span:has-text("Add")')
    expect(addButton).toBeTruthy()
    await addButton?.click()
    await page.waitForTimeout(1000)
    const pageTitle = await page.title()
    expect(pageTitle).toContain('User')
    expect(pageTitle).toContain('Create')
    const pagePath = await page.url()
    expect(pagePath).toBe(url('/admin/users/create'))
    const submitButton = await page.$('button:has-text("Create")')
    expect(submitButton).toBeTruthy()
    const nameInput = await page.$('input[name="name"]')
    expect(nameInput).toBeTruthy()
    await nameInput?.fill('User 1')
    const emailInput = await page.$('input[name="email"]')
    expect(emailInput).toBeTruthy()
    await emailInput?.fill('user1@example.com')
    await page.keyboard.press('Tab')
    await submitButton?.click()

    await page.waitForTimeout(1000)
    const pagePath3 = await page.url()
    expect(pagePath3).toBe(url('/admin/users'))

    // find tr with "User 1" text inside second td
    const tr = await page.$('tr:has(td:has-text("User 1"))')
    expect(tr).toBeTruthy()
  })
}, 50000)

describe('posts', async () => {
  it('should create a post', async () => {
    const page = await createPage()
    await page.goto(url('/admin/posts'), { waitUntil: 'hydration' })
    // find button with text Add inside a span of a tr that has "Posts" text inside first td of the same tr
    const addButton = await page.$('span:has-text("Add")')
    expect(addButton).toBeTruthy()
    await addButton?.click()
    await page.waitForTimeout(1000)
    const pageTitle = await page.title()
    expect(pageTitle).toContain('Post')
    expect(pageTitle).toContain('Create')
    const pagePath = await page.url()
    expect(pagePath).toBe(url('/admin/posts/create'))
    const submitButton = await page.$('button:has-text("Create")')
    expect(submitButton).toBeTruthy()

    // set title to "Post 1"
    const titleInput = await page.$('input[name="title"]')
    expect(titleInput).toBeTruthy()
    await titleInput?.fill('Post 1')

    const slugInput = await page.$('input[name="slug"]')
    expect(slugInput).toBeTruthy()
    await slugInput?.fill('post-1')

    const publishedAtDatePickerButton = await page.$('button:has-text("Pick a date")')
    expect(publishedAtDatePickerButton).toBeTruthy()
  }, 50000)
})
