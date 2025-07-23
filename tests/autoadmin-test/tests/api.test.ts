import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

await setup({
  host: 'http://localhost:3000',
})

describe('api', async () => {
  it('should delete all records', async () => {
    const modelLabels = ['posts', 'tags', 'users', 'categories']
    for (const modelLabel of modelLabels) {
      const response = await $fetch<{ results: { id: number }[] }>(`/api/autoadmin/${modelLabel}`)
      expect(response).toBeDefined()
      const rowIds = response.results.map((row: any) => row.id)
      expect(rowIds).toBeDefined()
      if (rowIds.length > 0) {
      // bulk delete all posts
        const deleteResponse = await $fetch('/api/autoadmin/bulk-delete', {
          method: 'POST',
          body: {
            modelLabel,
            rowLookups: rowIds,
          },
        })
        expect(deleteResponse).toBeDefined()
      }
    }
  })

  it('should create 2 records for each model', async () => {
    const modelConfigs = [
      {
        modelLabel: 'tags',
        payloads: [
          { name: 'Tag 1', color: 'red' },
          { name: 'Tag 2', color: 'blue' },
        ],
      },
      {
        modelLabel: 'users',
        payloads: [
          { name: 'User 1', email: 'user1@example.com' },
          { name: 'User 2', email: 'user2@example.com' },
        ],
      },
      {
        modelLabel: 'categories',
        payloads: [
          { name: 'Category 1' },
          { name: 'Category 2' },
        ],
      },
    ]

    for (const { modelLabel, payloads } of modelConfigs) {
      // Create first record
      const response1 = await $fetch<{ data: { id: number } }>(`/api/autoadmin/${modelLabel}`, {
        method: 'POST',
        body: payloads[0]!,
      })
      expect(response1.data.id).toBeDefined()

      // Create second record
      const response2 = await $fetch<{ data: { id: number } }>(`/api/autoadmin/${modelLabel}`, {
        method: 'POST',
        body: payloads[1]!,
      })
      expect(response2.data.id).toBeDefined()

      // Verify list contains both records
      const listResponse = await $fetch<{ results: { name: string }[] }>(`/api/autoadmin/${modelLabel}`)
      expect(listResponse.results.length).toBe(2)
      expect(listResponse.results[0]!.name).toBe(payloads[0]!.name)
      expect(listResponse.results[1]!.name).toBe(payloads[1]!.name)
    }
  })

  it('should create a post', async () => {
    // Get formspec for posts
    const formSpec = await $fetch('/api/autoadmin/formspec/posts')
    expect(formSpec).toEqual({
      "spec": {
        "fields": [
          {
            "name": "title",
            "label": "Title",
            "type": "text",
            "required": true,
            "rules": {}
          },
          {
            "name": "slug",
            "label": "Slug",
            "type": "text",
            "required": true,
            "rules": {}
          },
          {
            "name": "excerpt",
            "label": "Excerpt",
            "type": "textarea",
            "required": false,
            "rules": {},
            "help": "Brief summary of the post (max 200 characters)",
            "inputAttrs": {
              "maxlength": 200
            }
          },
          {
            "name": "content",
            "label": "Post Content",
            "type": "rich-text",
            "required": false,
            "rules": {}
          },
          {
            "name": "featuredImage",
            "label": "Featured Image",
            "type": "image",
            "required": false,
            "rules": {},
            "fileConfig": {
              "accept": [
                ".jpg",
                ".jpeg",
                ".png",
                ".webp"
              ],
              "prefix": "posts/",
              "maxSize": 5242880
            }
          },
          {
            "name": "status",
            "label": "Status",
            "type": "select",
            "required": false,
            "rules": {},
            "options": [
              "draft",
              "published",
              "archived"
            ],
            "defaultValue": "draft"
          },
          {
            "name": "views",
            "label": "Views",
            "type": "number",
            "required": false,
            "rules": {
              "min": -9007199254740991,
              "max": 9007199254740991
            },
            "defaultValue": 0
          },
          {
            "name": "isCommentsEnabled",
            "label": "Is Comments Enabled",
            "type": "boolean",
            "required": false,
            "rules": {},
            "defaultValue": true
          },
          {
            "name": "publishedAt",
            "label": "Published At",
            "type": "date",
            "required": false,
            "rules": {}
          },
          {
            "name": "authorId",
            "label": "Author",
            "type": "relation",
            "required": true,
            "rules": {
              "min": -9007199254740991,
              "max": 9007199254740991
            },
            "relationConfig": {
              "choicesEndpoint": "/api/autoadmin/formspec/posts/choices/authorId",
              "relatedConfigKey": "users",
              "enableCreate": true,
              "enableUpdate": true,
              "foreignRelatedColumnName": "id",
              "foreignLabelColumnName": "email"
            }
          },
          {
            "name": "categoryId",
            "label": "Category",
            "type": "relation",
            "required": false,
            "rules": {
              "min": -9007199254740991,
              "max": 9007199254740991
            },
            "relationConfig": {
              "choicesEndpoint": "/api/autoadmin/formspec/posts/choices/categoryId",
              "relatedConfigKey": "categories",
              "enableCreate": true,
              "enableUpdate": true,
              "foreignRelatedColumnName": "id",
              "foreignLabelColumnName": "name"
            }
          },
          {
            "name": "___tags___tagId",
            "type": "relation-many",
            "label": "Tags",
            "relationConfig": {
              "choicesEndpoint": "/api/autoadmin/formspec/posts/choices-many/___tags___tagId",
              "enableCreate": true,
              "enableUpdate": true
            },
            "required": false,
            "rules": {},
            "options": []
          }
        ],
        "warnOnUnsavedChanges": true
      }
    })

    const authors = await $fetch<{label: string, value: number}[]>(formSpec.spec.fields.find((field: any) => field.name === 'authorId')?.relationConfig?.choicesEndpoint!)
    const authorId = authors[0]?.value
    expect(authorId).toBeTruthy()

    const categories = await $fetch<{label: string, value: number}[]>(formSpec.spec.fields.find((field: any) => field.name === 'categoryId')?.relationConfig?.choicesEndpoint!)
    const categoryId = categories[0]?.value
    expect(categoryId).toBeTruthy()

    const tags = await $fetch<{label: string, value: number}[]>(formSpec.spec.fields.find((field: any) => field.name === '___tags___tagId')?.relationConfig?.choicesEndpoint!)
    const tagIds = tags.map((tag: any) => tag.value)
    expect(tagIds).toBeTruthy()

    // Create post
    const postPayload = {
      title: 'Post 1',
      slug: 'post-1',
      excerpt: 'Excerpt 1',
      content: 'Content 1',
      featuredImage: 'https://example.com/image.jpg',
      publishedAt: '1991-12-15',
      status: 'published',
      views: 100,
      isCommentsEnabled: false,
      authorId,
      categoryId,
      tagIds,
    }
    const postResponse = await $fetch<{ data: { id: number } }>('/api/autoadmin/posts', {
      method: 'POST',
      body: postPayload,
    })
    expect(postResponse.data.id).toBeTruthy()
  })

})