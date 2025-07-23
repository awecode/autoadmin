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
})
