// @vitest-environment node

import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { getAdminDialectFromUrl } from '../../../server/utils/dialect'
import { handleDrizzleError } from '../../../server/utils/drizzle'
import { getTableMetadata } from '../../../server/utils/metadata'
import { getTableForeignKeys, getTableForeignKeysByColumn } from '../../../server/utils/relation'
import { posts, postsToTags, users } from '../server/db/postgres'

describe('postgres support helpers', () => {
  it('detects postgres URLs', () => {
    expect(getAdminDialectFromUrl('postgres://user:pass@localhost:5432/app')).toBe('postgres')
    expect(getAdminDialectFromUrl('postgresql://user:pass@localhost:5432/app')).toBe('postgres')
    expect(getAdminDialectFromUrl('file:./db.sqlite')).toBe('sqlite')
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
})
