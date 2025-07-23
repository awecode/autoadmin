import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import postsCreateFormSpec from './fixtures/posts-create-formspec.json'
import postsFilters from './fixtures/posts-filters.json'
import postsUpdateFormSpec from './fixtures/posts-update-formspec.json'

await setup({
  host: 'http://localhost:3000',
})

describe('api', async () => {
  it('should clear any m2m relation of post with tags', async () => {
    // get all posts
    const postsResponse = await $fetch<{ results: { id: number }[] }>('/api/autoadmin/posts')
    const postIds = postsResponse.results.map((post: any) => post.id)

    // Get choices for required fields
    const formSpec = await $fetch<any>('/api/autoadmin/formspec/posts')
    const authors = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'authorId')?.relationConfig?.choicesEndpoint)
    const authorId = authors[0]?.value

    for (const postId of postIds) {
      // send a post request with empty ___tags___tagId and required dummy values
      await $fetch(`/api/autoadmin/posts/${postId}`, {
        method: 'POST',
        body: {
          title: 'Dummy Title',
          slug: `dummy-slug-${postId}`,
          authorId,
          ___tags___tagId: [],
        },
      })
    }
  })

  it('should delete all records', async () => {
    const modelLabels = ['tags', 'posts', 'users', 'categories']
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
    expect(formSpec).toEqual(postsCreateFormSpec)
    const authors = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'authorId')?.relationConfig?.choicesEndpoint)
    const authorId = authors[0]?.value
    expect(authorId).toBeTruthy()

    const categories = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'categoryId')?.relationConfig?.choicesEndpoint)
    const categoryId = categories[0]?.value
    expect(categoryId).toBeTruthy()

    const tags = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === '___tags___tagId')?.relationConfig?.choicesEndpoint)
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
      ___tags___tagId: [tagIds[0]],
    }
    const postResponse = await $fetch<{ data: { id: number } }>('/api/autoadmin/posts', {
      method: 'POST',
      body: postPayload,
    })
    expect(postResponse.data.id).toBeTruthy()
  })

  it('should update the created post', async () => {
    // Get the list of posts to find the created post
    const postsResponse = await $fetch<{ results: { id: number, title: string, slug: string }[] }>('/api/autoadmin/posts')
    expect(postsResponse.results.length).toBeGreaterThan(0)

    const createdPost = postsResponse.results.find(post => post.title === 'Post 1')
    expect(createdPost).toBeTruthy()
    const postId = createdPost!.id

    const formSpec = await $fetch<any>(`/api/autoadmin/formspec/posts/update/${postId}`)

    // Compare formSpec with postsUpdateFormSpec but ignore createdAt and updatedAt fields
    const { createdAt: _c1, updatedAt: _u1, ...formSpecValues } = formSpec.spec.values
    const { createdAt: _c2, updatedAt: _u2, ...expectedValues } = postsUpdateFormSpec.spec.values

    expect({ ...formSpec, spec: { ...formSpec.spec, values: formSpecValues } })
      .toEqual({ ...postsUpdateFormSpec, spec: { ...postsUpdateFormSpec.spec, values: expectedValues } })

    const authors = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'authorId')?.relationConfig?.choicesEndpoint)
    const authorId = authors[1]?.value

    const categories = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'categoryId')?.relationConfig?.choicesEndpoint)
    const categoryId = categories[1]?.value

    const tags = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === '___tags___tagId')?.relationConfig?.choicesEndpoint)
    const tagIds = tags.map((tag: any) => tag.value)

    // Update post with new data
    const updatePayload = {
      title: 'Updated Post 1',
      slug: 'updated-post-1',
      excerpt: 'Updated excerpt for post 1',
      content: 'Updated content for post 1',
      featuredImage: 'https://example.com/updated-image.jpg',
      publishedAt: '2023-12-15',
      status: 'draft',
      views: 150,
      isCommentsEnabled: true,
      authorId,
      categoryId,
      tagIds,
    }

    const updateResponse = await $fetch<{ data: { id: number } }>(`/api/autoadmin/posts/${postId}`, {
      method: 'POST',
      body: updatePayload,
    })
    expect(updateResponse.data.id).toBe(postId)

    // Verify the post was updated by fetching it again
    const updatedPostResponse = await $fetch<{ results: Record<string, any>[] }>('/api/autoadmin/posts')
    const updatedPost = updatedPostResponse.results.find(post => post.id === postId)
    expect(updatedPost!.title).toBe('Updated Post 1')
    expect(updatedPost!.status).toBe('draft')
    expect(updatedPost!.authorId__name).toBe('User 2')
    expect(updatedPost!.categoryId__name).toBe('Category 2')
    expect(updatedPost!.field).toBe('150 views')
  })

  it('should return correct filters structure for posts', async () => {
    const response = await $fetch<{ filters: any[] }>('/api/autoadmin/posts')
    expect(response.filters).toEqual(postsFilters)
  })

  it('should filter posts correctly using query parameters', async () => {
    // First, let's get available data for filtering
    const formSpec = await $fetch<any>('/api/autoadmin/formspec/posts')
    const authors = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'authorId')?.relationConfig?.choicesEndpoint)
    const categories = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'categoryId')?.relationConfig?.choicesEndpoint)

    const authorId = authors[1]?.value // Use User 2
    const categoryId = categories[1]?.value // Use Category 2

    // Create a test post with specific filter values for testing
    const testPostPayload = {
      title: 'Test Filter Post',
      slug: 'test-filter-post',
      excerpt: 'Test post for filtering',
      content: 'Content for filter test',
      featuredImage: 'https://example.com/filter-test.jpg',
      publishedAt: '2025-07-08',
      status: 'published',
      views: 200,
      isCommentsEnabled: true,
      authorId,
      categoryId,
      ___tags___tagId: [],
    }

    const createResponse = await $fetch<{ data: { id: number } }>('/api/autoadmin/posts', {
      method: 'POST',
      body: testPostPayload,
    })
    expect(createResponse.data.id).toBeTruthy()

    // Test filtering with multiple parameters
    const filterUrl = `/api/autoadmin/posts?status=published&authorId=${authorId}&categoryId=${categoryId}&isCommentsEnabled=true&publishedAt=2025-07-08,2025-07-09`
    const filteredResponse = await $fetch<{ results: Record<string, any>[] }>(filterUrl)

    // Verify the filtered results contain our test post
    expect(filteredResponse.results.length).toBeGreaterThan(0)
    const testPost = filteredResponse.results.find(post => post.title === 'Test Filter Post')
    expect(testPost).toBeTruthy()
    expect(testPost!.status).toBe('published')
    expect(testPost!.authorId__name).toBe('User 2')
    expect(testPost!.categoryId__name).toBe('Category 2')
    expect(testPost!.field).toBe('200 views')

    // Test that filtering excludes posts that don't match
    const excludeFilterUrl = `/api/autoadmin/posts?status=draft`
    const excludeResponse = await $fetch<{ results: Record<string, any>[] }>(excludeFilterUrl)
    const draftTestPost = excludeResponse.results.find(post => post.title === 'Test Filter Post')
    expect(draftTestPost).toBeFalsy() // Should not find our published post in draft filter
  })
})
