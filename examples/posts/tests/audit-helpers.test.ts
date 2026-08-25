// @vitest-environment node
import type { AuditEntry } from '#layers/autoadmin/server/utils/audit'
import { configureAudit, emitAuditEvent, sanitizeAuditRecord } from '#layers/autoadmin/server/utils/audit'
import { describe, expect, it } from 'vitest'

describe('audit helpers', () => {
  it('sanitizeAuditRecord respects exclude and include lists', () => {
    const record = {
      id: 1,
      title: 'Hello',
      password: 'secret',
      content: 'body',
    }

    expect(sanitizeAuditRecord(record, {
      excludeFields: ['password'],
      globalExcludeFields: ['content'],
    })).toEqual({ id: 1, title: 'Hello' })

    expect(sanitizeAuditRecord(record, {
      includeFields: ['id', 'title'],
      excludeFields: ['title'],
    })).toEqual({ id: 1, title: 'Hello' })
  })

  it('auditRecordsEqual ignores key order', async () => {
    const { auditRecordsEqual } = await import('#layers/autoadmin/server/utils/audit')
    expect(auditRecordsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(auditRecordsEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('diffAuditRecords keeps only changed keys', async () => {
    const { diffAuditRecords } = await import('#layers/autoadmin/server/utils/audit')

    expect(diffAuditRecords(
      { id: 1, title: 'Old', status: 'draft' },
      { id: 1, title: 'New', status: 'draft' },
    )).toEqual({
      before: { title: 'Old' },
      after: { title: 'New' },
    })

    expect(diffAuditRecords(
      { id: 1, title: 'Same' },
      { id: 1, title: 'Same' },
    )).toBeUndefined()

    expect(diffAuditRecords(
      { id: 1, title: 'A', nested: { x: 1 } },
      { id: 1, title: 'A', nested: { x: 2 } },
    )).toEqual({
      before: { nested: { x: 1 } },
      after: { nested: { x: 2 } },
    })
  })

  it('emitAuditEvent uses custom write and does not throw on writer failure', async () => {
    const entries: AuditEntry[] = []
    configureAudit({
      write: async (entry) => {
        entries.push(entry)
      },
    })

    await emitAuditEvent({
      action: 'create',
      modelKey: 'posts',
      lookupValue: 9,
      changes: { after: { id: 9, title: 'x' } },
    })

    expect(entries).toHaveLength(1)
    expect(entries[0]?.action).toBe('create')
    expect(entries[0]?.modelKey).toBe('posts')
    expect(entries[0]?.lookupValue).toBe(9)

    configureAudit({
      write: async () => {
        throw new Error('sink down')
      },
    })

    await expect(emitAuditEvent({
      action: 'delete',
      modelKey: 'posts',
      lookupValue: 9,
    })).resolves.toBeUndefined()
  })

  it('isModelAuditEnabled respects global enabled and per-model opt-out', async () => {
    const { isModelAuditEnabled, configureAudit: configure } = await import('#layers/autoadmin/server/utils/audit')

    configure({})
    expect(isModelAuditEnabled(undefined)).toBe(false)
    expect(isModelAuditEnabled(true)).toBe(true)

    configure({ enabled: true })
    expect(isModelAuditEnabled(undefined)).toBe(true)
    expect(isModelAuditEnabled(false)).toBe(false)
    expect(isModelAuditEnabled({ enabled: false })).toBe(false)
    expect(isModelAuditEnabled({ excludeFields: ['secret'] })).toBe(true)

    configure({})
  })

  it('isMissingTableError detects sqlite and postgres missing-table errors', async () => {
    const { isMissingTableError } = await import('#layers/autoadmin/server/utils/audit')
    expect(isMissingTableError(new Error('no such table: autoadmin_audit_logs'))).toBe(true)
    expect(isMissingTableError({ code: '42P01', message: 'relation "autoadmin_audit_logs" does not exist' })).toBe(true)
    expect(isMissingTableError(new Error('UNIQUE constraint failed'))).toBe(false)
  })

  it('configureAudit without table or write resolves a default table when options are set', async () => {
    const { configureAudit: configure, getAuditConfig, isOwnedAuditTable } = await import('#layers/autoadmin/server/utils/audit')
    configure({ enabled: true })
    expect(isOwnedAuditTable(getAuditConfig().table)).toBe(true)
    configure({})
    expect(getAuditConfig().table).toBeUndefined()
  })
})
