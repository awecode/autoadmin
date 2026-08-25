import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import { resetDatabase } from './helpers/resetDatabase'

await setup({
  host: 'http://localhost:3000',
})

const apiPrefix = '/api/autoadmin'

describe('audit logs', () => {
  beforeAll(async () => {
    await resetDatabase()
  })

  it('logs create, update, delete, bulkDelete, and relation.m2m for posts', async () => {
    // resetDatabase clears users; seed required FK targets before creating posts.
    const author = await $fetch<{ data: { id: number } }>(`${apiPrefix}/users`, {
      method: 'POST',
      body: {
        name: 'Audit Author',
        email: `audit-author-${Date.now()}@example.com`,
      },
    })
    const authorId = author.data.id

    const createdTag = await $fetch<{ data: { id: number } }>(`${apiPrefix}/tags`, {
      method: 'POST',
      body: { name: `audit-tag-${Date.now()}`, color: '#111111' },
    })
    const tagId = createdTag.data.id

    const created = await $fetch<{ data: { id: number, title: string } }>(`${apiPrefix}/posts`, {
      method: 'POST',
      body: {
        title: 'Audit Create Post',
        slug: `audit-create-${Date.now()}`,
        authorId,
        status: 'draft',
        ___tags___tagId: [tagId],
      },
    })
    const postId = created.data.id

    await $fetch(`${apiPrefix}/posts/${postId}`, {
      method: 'POST',
      body: {
        title: 'Audit Updated Post',
        slug: `audit-update-${postId}`,
        authorId,
        status: 'published',
        ___tags___tagId: [],
      },
    })

    await $fetch(`${apiPrefix}/posts/${postId}`, {
      method: 'DELETE',
    })

    const second = await $fetch<{ data: { id: number } }>(`${apiPrefix}/posts`, {
      method: 'POST',
      body: {
        title: 'Audit Bulk Post',
        slug: `audit-bulk-${Date.now()}`,
        authorId,
        status: 'draft',
      },
    })

    await $fetch(`${apiPrefix}/bulk-delete`, {
      method: 'POST',
      body: {
        modelKey: 'posts',
        rowLookups: [second.data.id],
      },
    })

    // List omits bulky JSON columns; load detail for changes/meta assertions.
    const logs = await $fetch<{ results: Array<{
      id: number
      action: string
      modelKey: string
      lookupValue: string | null
    }> }>(`${apiPrefix}/audit-logs?size=50`)

    const postLogSummaries = logs.results.filter(row => row.modelKey === 'posts')
    const postLogs = await Promise.all(postLogSummaries.map(async (row) => {
      return await $fetch<{
        id: number
        action: string
        modelKey: string
        lookupValue: string | null
        changes: { before?: Record<string, unknown>, after?: Record<string, unknown> } | null
        meta: Record<string, unknown> | null
      }>(`${apiPrefix}/audit-logs/${row.id}`)
    }))
    const actions = postLogs.map(row => row.action)

    expect(actions).toContain('create')
    expect(actions).toContain('update')
    expect(actions).toContain('delete')
    expect(actions).toContain('bulkDelete')
    expect(actions).toContain('relation.m2m')

    const createLog = postLogs.find(row => row.action === 'create' && row.lookupValue === String(postId))
    expect(createLog?.changes?.after).toBeTruthy()
    expect(createLog?.changes?.before).toBeFalsy()

    const updateLog = postLogs.find(row => row.action === 'update' && row.lookupValue === String(postId))
    expect(updateLog?.changes?.before).toBeTruthy()
    expect(updateLog?.changes?.after).toBeTruthy()
    // Sparse update payload: only changed columns, not the full row.
    expect(updateLog?.changes?.before).toMatchObject({
      title: 'Audit Create Post',
      status: 'draft',
    })
    expect(updateLog?.changes?.after).toMatchObject({
      title: 'Audit Updated Post',
      status: 'published',
    })
    expect(updateLog?.changes?.before).not.toHaveProperty('authorId')
    expect(updateLog?.changes?.after).not.toHaveProperty('authorId')

    const deleteLog = postLogs.find(row => row.action === 'delete' && row.lookupValue === String(postId))
    expect(deleteLog?.changes?.before).toBeTruthy()

    const bulkLog = postLogs.find(row => row.action === 'bulkDelete')
    expect(bulkLog?.meta?.lookupValues).toEqual(expect.arrayContaining([second.data.id]))

    const relationLogs = postLogs.filter(row => row.action === 'relation.m2m')
    expect(relationLogs.length).toBeGreaterThan(0)
    expect(relationLogs.some(row => Array.isArray(row.meta?.added) || Array.isArray(row.meta?.removed))).toBe(true)
  })

  it('does not log models that opt out of audit', async () => {
    const before = await $fetch<{ results: { id: number }[] }>(`${apiPrefix}/audit-logs?size=200`)
    const beforeCount = before.results.length

    await $fetch(`${apiPrefix}/tags`, {
      method: 'POST',
      body: {
        name: `no-audit-tag-${Date.now()}`,
        color: '#abcdef',
      },
    })

    const after = await $fetch<{ results: { id: number, modelKey: string }[] }>(`${apiPrefix}/audit-logs?size=200`)
    const tagLogs = after.results.filter(row => row.modelKey === 'tags')
    expect(tagLogs.length).toBe(0)
    expect(after.results.length).toBe(beforeCount)
  })
})
