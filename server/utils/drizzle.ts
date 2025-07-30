import type { Column } from 'drizzle-orm'
import { z } from 'zod'

export function colKey(col: Column) {
  const colName = col.name
  if (col.keyAsName) {
    return colName
  }
  const key = (Object.keys(col.table) as (keyof typeof col.table)[]).find(
    k => col.table[k]?.name === colName,
  )
  if (!key) {
    throw new Error(`Column key not found for column with name "${colName}"`)
  }
  return key
}

export const genericPaginationQuerySchema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().positive().max(
    100,
    `Page size must be less than or equal to 100`,
  ).default(10),
}).strip()

interface PaginatedResponse<T> {
  results: T[] | Record<string, any>[]
  aggregates?: Record<string, any>
  pagination: {
    count: number
    page: number
    size: number
    pages: number
  }
}

export async function getPaginatedResults<T>(
  baseQuery: any,
  countQuery: any,
  query: any,
): Promise<PaginatedResponse<T>> {
  const { page, size } = genericPaginationQuerySchema.parse(query)
  const offset = (page - 1) * size

  const [{ resultCount }] = await countQuery

  const results = await baseQuery
    .limit(size)
    .offset(offset)

  return {
    results,
    pagination: {
      count: Number(resultCount),
      page,
      size,
      pages: Math.ceil(Number(resultCount) / size),
    },
  }
}

// Careful, this function exposes table names and column names in the error message
export function handleDrizzleError(error: any) {
  const code = error.cause?.code ?? error.code

  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === '23505' || code === 'ER_DUP_ENTRY') {
    const fullMessage = error.cause?.message ?? error.message
    // const fullMessage = 'SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: customers.phoneNumber'
    // Programatically extract the table name and column name from the full message
    let userFriendlyMessage = 'Operation failed'
    const errorData = {
      name: '',
      message: '',
    }
    if (fullMessage.includes('SQLITE_CONSTRAINT_UNIQUE')) {
      const [table, column] = fullMessage.split(' ').at(-1).split('.')
      userFriendlyMessage = `One of the ${table} with this ${column} already exists.`
      errorData.name = column
      errorData.message = 'This value must be unique but is already in use.'
    }
    return {
      statusCode: 400,
      statusMessage: 'Validation Error',
      stack: '',
      data: {
        message: userFriendlyMessage,
        errors: [errorData],
      },
    }
  }

  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return {
      statusCode: 400,
      statusMessage: 'Cannot delete record because it is referenced by another record',
    }
  }

  // Format other database errors with code and message for debugging
  console.error('Database error:', {
    code: error.code || 'UNKNOWN',
    message: error.message,
    details: error,
  })
  return {
    statusCode: 500,
    message: 'A database error occurred',
    statusMessage: 'Database Error',
    stack: '',
  }
}
