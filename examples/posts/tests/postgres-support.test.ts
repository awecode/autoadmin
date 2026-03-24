// @vitest-environment node

import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { getHyperdriveConnectionString } from '../../../server/utils/db'
import { handleDrizzleError } from '../../../server/utils/drizzle'
import { getTableMetadata } from '../../../server/utils/metadata'
import { getTableForeignKeys, getTableForeignKeysByColumn } from '../../../server/utils/relation'
import { getDialectFromUrl } from '../../../utils/databaseDialect'
import { processSchemaForForm } from '../../../utils/form'
import { posts, postsToTags, users } from '../server/db/postgresql'

describe('postgres support helpers', () => {
  it('detects postgres URLs', () => {
    expect(getDialectFromUrl('postgres://user:pass@localhost:5432/app')).toBe('postgresql')
    expect(getDialectFromUrl('postgresql://user:pass@localhost:5432/app')).toBe('postgresql')
    expect(getDialectFromUrl('file:./db.sqlite')).toBe('sqlite')
  })

  it('resolves Hyperdrive connection strings from bindings', () => {
    expect(getHyperdriveConnectionString('postgresql://user:pass@localhost:5432/app')).toBe('postgresql://user:pass@localhost:5432/app')
    expect(getHyperdriveConnectionString({ connectionString: 'postgresql://user:pass@localhost:5432/app' })).toBe('postgresql://user:pass@localhost:5432/app')
    expect(getHyperdriveConnectionString({})).toBeUndefined()
    expect(getHyperdriveConnectionString(undefined)).toBeUndefined()
  })

  it('reads postgres foreign keys from schemas', () => {
    const postRelations = getTableForeignKeys(posts)
    expect(postRelations.map(relation => relation.name).sort()).toEqual(['authorId', 'categoryId'])

    const authorRelation = getTableForeignKeysByColumn(posts, 'authorId')
    expect(authorRelation).toHaveLength(1)
    expect(authorRelation[0]!.foreignTable).toBe(users)

    const m2mRelations = getTableForeignKeys(postsToTags)
    expect(m2mRelations.map(relation => relation.name).sort()).toEqual(['postId', 'tagId'])
  })

  it('infers metadata from postgres schemas', () => {
    const metadata = getTableMetadata(getTableColumns(posts))
    expect(metadata.primaryAutoincrementColumns).toContain('id')
    expect(metadata.autoTimestampColumns).toEqual(expect.arrayContaining(['createdAt', 'updatedAt']))
    expect(metadata.datetimeColumns).toEqual([])
  })

  it('formats postgres unique violations as validation errors', () => {
    expect(handleDrizzleError({
      code: '23505',
      table: 'tags',
      detail: 'Key (name)=(Tag 1) already exists.',
    })).toMatchObject({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: {
        message: 'One of the tags with this name already exists.',
        errors: [{
          name: 'name',
          message: 'This value must be unique but is already in use.',
        }],
      },
    })
  })

  it('formats postgres foreign key and not-null violations', () => {
    expect(handleDrizzleError({ code: '23503' })).toMatchObject({
      statusCode: 400,
      statusMessage: 'Cannot delete record because it is referenced by another record',
    })

    expect(handleDrizzleError({ code: '23502', column: 'authorId' })).toMatchObject({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: {
        message: 'authorId cannot be empty.',
        errors: [{
          name: 'authorId',
          message: 'This field is required.',
        }],
      },
    })
  })

  it('keeps real schema fields when processing form schemas', () => {
    const schema = z.object({
      title: z.string(),
      slug: z.string(),
      authorId: z.number(),
    })

    const processed = processSchemaForForm(schema, {
      fields: [
        { name: 'title', type: 'text' },
        { name: 'authorId', type: 'relation' },
        { name: '___tags___tagId', type: 'relation-many' },
      ],
    })

    expect(Object.keys(processed.shape)).toEqual(['title', 'authorId'])
  })
})
