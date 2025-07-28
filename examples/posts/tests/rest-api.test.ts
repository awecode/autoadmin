import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import postsCreateFormSpec from './fixtures/posts-create-formspec.json'
import postsFilters from './fixtures/posts-filters.json'
import postsUpdateFormSpec from './fixtures/posts-update-formspec.json'

await setup({
  host: 'http://localhost:3000',
})

const apiPrefix = '/api/autoadmin'

describe('api', async () => {
  it('should clear any m2m relation of post with tags', async () => {
    // get all posts
    const postsResponse = await $fetch<{ results: { id: number }[] }>(`${apiPrefix}/posts`)
    const postIds = postsResponse.results.map((post: any) => post.id)

    // Get choices for required fields
    const formSpec = await $fetch<any>(`${apiPrefix}/formspec/posts`)
    const authors = await $fetch<{ label: string, value: number }[]>(formSpec.spec.fields.find((field: any) => field.name === 'authorId')?.relationConfig?.choicesEndpoint)
    const authorId = authors[0]?.value

    for (const postId of postIds) {
      // send a post request with empty ___tags___tagId and required dummy values
      await $fetch(`${apiPrefix}/posts/${postId}`, {
        method: 'POST',
        body: {
          title: 'Dummy Title',
          slug: `dummy-slug-${postId}`,
          authorId,
          ___tags___tagId: [],
        },
      })
      // test if the post has no tags
      const postResponse = await $fetch<{ spec: { values: { ___tags___tagId: number[] } } }>(`${apiPrefix}/formspec/posts/update/${postId}`)
      expect(postResponse.spec.values.___tags___tagId).toBeUndefined()
    }
  })

  it('should delete all records', async () => {
    const modelLabels = ['tags', 'posts', 'users', 'categories']
    for (const modelLabel of modelLabels) {
      const response = await $fetch<{ results: { id: number }[] }>(`${apiPrefix}/${modelLabel}`)
      expect(response).toBeDefined()
      const rowIds = response.results.map((row: any) => row.id)
      expect(rowIds).toBeDefined()
      if (rowIds.length > 0) {
      // bulk delete all posts
        const deleteResponse = await $fetch(`${apiPrefix}/bulk-delete`, {
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
    const cfgs = [
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

    for (const { modelLabel, payloads } of cfgs) {
      // Create first record
      const response1 = await $fetch<{ data: { id: number } }>(`${apiPrefix}/${modelLabel}`, {
        method: 'POST',
        body: payloads[0]!,
      })
      expect(response1.data.id).toBeDefined()

      // Create second record
      const response2 = await $fetch<{ data: { id: number } }>(`${apiPrefix}/${modelLabel}`, {
        method: 'POST',
        body: payloads[1]!,
      })
      expect(response2.data.id).toBeDefined()

      // Verify list contains both records
      const listResponse = await $fetch<{ results: { name: string }[] }>(`${apiPrefix}/${modelLabel}`)
      expect(listResponse.results.length).toBe(2)
      expect(listResponse.results[0]!.name).toBe(payloads[1]!.name)
      expect(listResponse.results[1]!.name).toBe(payloads[0]!.name)
    }
  })

  it('should create a post', async () => {
    // Get formspec for posts
    const formSpec = await $fetch(`${apiPrefix}/formspec/posts`)
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
    const postResponse = await $fetch<{ data: { id: number } }>(`${apiPrefix}/posts`, {
      method: 'POST',
      body: postPayload,
    })
    expect(postResponse.data.id).toBeTruthy()
  })

  it('should update the created post', async () => {
    // Get the list of posts to find the created post
    const postsResponse = await $fetch<{ results: { id: number, title: string, slug: string }[] }>(`${apiPrefix}/posts`)
    expect(postsResponse.results.length).toBeGreaterThan(0)

    const createdPost = postsResponse.results.find(post => post.title === 'Post 1')
    expect(createdPost).toBeTruthy()
    const postId = createdPost!.id

    const formSpec = await $fetch<any>(`${apiPrefix}/formspec/posts/update/${postId}`)

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

    const updateResponse = await $fetch<{ data: { id: number } }>(`${apiPrefix}/posts/${postId}`, {
      method: 'POST',
      body: updatePayload,
    })
    expect(updateResponse.data.id).toBe(postId)

    // Verify the post was updated by fetching it again
    const updatedPostResponse = await $fetch<{ results: Record<string, any>[] }>(`${apiPrefix}/posts`)
    const updatedPost = updatedPostResponse.results.find(post => post.id === postId)
    expect(updatedPost!.title).toBe('Updated Post 1')
    expect(updatedPost!.status).toBe('draft')
    expect(updatedPost!.authorId__name).toBe('User 2')
    expect(updatedPost!.categoryId__name).toBe('Category 2')
    expect(updatedPost!.field).toBe('150 views')
  })

  it('should return correct filters structure for posts', async () => {
    const response = await $fetch<{ filters: any[] }>(`${apiPrefix}/posts`)
    expect(response.filters).toEqual(postsFilters)
  })

  it('should filter posts correctly using query parameters', async () => {
    // First, let's get available data for filtering
    const formSpec = await $fetch<any>(`${apiPrefix}/formspec/posts`)
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

    const createResponse = await $fetch<{ data: { id: number } }>(`${apiPrefix}/posts`, {
      method: 'POST',
      body: testPostPayload,
    })
    expect(createResponse.data.id).toBeTruthy()

    // Create dynamic date ranges using current datetime since records were just created
    const now = new Date()
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD format
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Use today's date for both createdAt and updatedAt filters since records were just created
    const createdAtDate = today
    const updatedAtDate = today

    // Test filtering with multiple parameters including dynamic timestamps
    const filterUrl = `${apiPrefix}/posts?status=published&authorId=${authorId}&categoryId=${categoryId}&isCommentsEnabled=true&publishedAt=2025-07-08,2025-07-09&createdAt=${createdAtDate}&updatedAt=${updatedAtDate},${tomorrow}`
    const filteredResponse = await $fetch<{ results: Record<string, any>[] }>(filterUrl)

    // Verify the filtered results contain our test post
    expect(filteredResponse.results.length).toBeGreaterThan(0)
    const testPost = filteredResponse.results.find(post => post.title === 'Test Filter Post')
    expect(testPost).toBeTruthy()
    expect(testPost!.status).toBe('published')
    expect(testPost!.authorId__name).toBe('User 2')
    expect(testPost!.categoryId__name).toBe('Category 2')
    expect(testPost!.field).toBe('200 views')

    // Test individual timestamp filters
    const createdAtFilterUrl = `${apiPrefix}/posts?createdAt=${createdAtDate}`
    const createdAtResponse = await $fetch<{ results: Record<string, any>[] }>(createdAtFilterUrl)
    const createdAtPost = createdAtResponse.results.find(post => post.title === 'Test Filter Post')
    expect(createdAtPost).toBeTruthy()

    const updatedAtFilterUrl = `${apiPrefix}/posts?updatedAt=${updatedAtDate},${tomorrow}`
    const updatedAtResponse = await $fetch<{ results: Record<string, any>[] }>(updatedAtFilterUrl)
    const updatedAtPost = updatedAtResponse.results.find(post => post.title === 'Test Filter Post')
    expect(updatedAtPost).toBeTruthy()

    // Test that filtering excludes posts that don't match
    const excludeFilterUrl = `${apiPrefix}/posts?status=draft`
    const excludeResponse = await $fetch<{ results: Record<string, any>[] }>(excludeFilterUrl)
    const draftTestPost = excludeResponse.results.find(post => post.title === 'Test Filter Post')
    expect(draftTestPost).toBeFalsy() // Should not find our published post in draft filter

    // Test date filters that should exclude the test post
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dayBeforeYesterday = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Test createdAt filter with yesterday (should not include today's post)
    const yesterdayCreatedFilterUrl = `${apiPrefix}/posts?createdAt=${yesterday}`
    const yesterdayCreatedResponse = await $fetch<{ results: Record<string, any>[] }>(yesterdayCreatedFilterUrl)
    const yesterdayCreatedPost = yesterdayCreatedResponse.results.find(post => post.title === 'Test Filter Post')
    expect(yesterdayCreatedPost).toBeFalsy() // Should not find today's post when filtering for yesterday

    // Test updatedAt filter with date range that excludes today
    const pastRangeFilterUrl = `${apiPrefix}/posts?updatedAt=${dayBeforeYesterday},${yesterday}`
    const pastRangeResponse = await $fetch<{ results: Record<string, any>[] }>(pastRangeFilterUrl)
    const pastRangePost = pastRangeResponse.results.find(post => post.title === 'Test Filter Post')
    expect(pastRangePost).toBeFalsy() // Should not find today's post in past date range

    // Test createdAt filter with future date (should not include today's post)
    const futureCreatedFilterUrl = `${apiPrefix}/posts?createdAt=${nextWeek}`
    const futureCreatedResponse = await $fetch<{ results: Record<string, any>[] }>(futureCreatedFilterUrl)
    const futureCreatedPost = futureCreatedResponse.results.find(post => post.title === 'Test Filter Post')
    expect(futureCreatedPost).toBeFalsy() // Should not find today's post when filtering for future date

    // Test updatedAt filter with future date range (should not include today's post)
    const futureWeekAfter = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const futureRangeFilterUrl = `${apiPrefix}/posts?updatedAt=${nextWeek},${futureWeekAfter}`
    const futureRangeResponse = await $fetch<{ results: Record<string, any>[] }>(futureRangeFilterUrl)
    const futureRangePost = futureRangeResponse.results.find(post => post.title === 'Test Filter Post')
    expect(futureRangePost).toBeFalsy() // Should not find today's post in future date range
  })
})
