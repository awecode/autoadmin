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
})