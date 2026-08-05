// @vitest-environment node
import { createClient } from '@libsql/client'
import { eq, getTableColumns, getTableName } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { describe, expect, it } from 'vitest'
import { aliasRelationTable } from '../../../server/utils/dialect'
import { colKey } from '../../../server/utils/drizzle'
import { getTableForeignKeys, getTableForeignKeysByColumn } from '../../../server/utils/relation'
import { categories } from '../server/db/sqlite'

describe('self-referential foreign keys', () => {
  it('discovers parentId as an FK to the same categories table', () => {
    const relations = getTableForeignKeys(categories)
    const parent = relations.find(relation => relation.name === 'parentId')
    expect(parent).toBeTruthy()
    expect(parent!.foreignTable).toBe(categories)
    expect(colKey(parent!.foreignColumn)).toBe('id')

    const byColumn = getTableForeignKeysByColumn(categories, 'parentId')
    expect(byColumn).toHaveLength(1)
    expect(byColumn[0]!.foreignTable).toBe(categories)
  })

  it('runs a self-join list query with aliased parent columns', async () => {
    const client = createClient({ url: ':memory:' })
    const db = drizzle(client, { casing: 'snake_case' })

    await db.run(`CREATE TABLE categories (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL,
      description text,
      is_active integer DEFAULT 1,
      parent_id integer REFERENCES categories(id),
      created_at integer NOT NULL DEFAULT (unixepoch())
    )`)

    await db.insert(categories).values([
      { name: 'Root' },
      { name: 'Child', parentId: 1 },
    ])

    // Broken pattern (no alias): joining categories to itself without alias fails.
    await expect(
      db.select({
        id: categories.id,
        name: categories.name,
        parentName: categories.name,
      }).from(categories).leftJoin(categories, eq(categories.parentId, categories.id)).all(),
    ).rejects.toThrow()

    // Fixed pattern: alias the parent side (same approach as listRecords).
    const parent = aliasRelationTable(categories, 'parentId_id')
    const parentCols = getTableColumns(parent)
    expect(parent).not.toBe(categories)
    expect(getTableName(parent)).toBe('parentId_id')

    const rows = await db.select({
      id: categories.id,
      name: categories.name,
      parentId__name: parentCols.name,
    }).from(categories).leftJoin(parent, eq(categories.parentId, parentCols.id!)).orderBy(categories.id).all()

    expect(rows).toEqual([
      { id: 1, name: 'Root', parentId__name: null },
      { id: 2, name: 'Child', parentId__name: 'Root' },
    ])
  })
})
