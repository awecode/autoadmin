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

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

export const genericPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().positive(),
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
  const paginationConfig = useRuntimeConfig().public.pagination
  query.size = query.size ?? (paginationConfig && typeof paginationConfig === 'object' && 'defaultSize' in paginationConfig && typeof paginationConfig.defaultSize === 'number' ? paginationConfig.defaultSize : DEFAULT_PAGE_SIZE)
  const maxSize = paginationConfig && typeof paginationConfig === 'object' && 'maxSize' in paginationConfig && typeof paginationConfig.maxSize === 'number' ? paginationConfig.maxSize : MAX_PAGE_SIZE
  if (query.size > maxSize) {
    query.size = maxSize
  }
  const { page, size } = genericPaginationQuerySchema.parse(query)
  const offset = (page - 1) * size

  const [{ resultCount }] = await countQuery
  const totalCount = Number(resultCount)
  const totalPages = Math.ceil(totalCount / size)

  if (page > 1 && offset >= totalCount) {
    throw createError({
      statusCode: 404,
      statusMessage: 'The requested page does not exist.',
    })
  }

  const results = await baseQuery
    .limit(size)
    .offset(offset)

  return {
    results,
    pagination: {
      count: totalCount,
      page,
      size,
      pages: totalPages,
    },
  }
}

// Careful, this function exposes table names and column names in the error message
export function handleDrizzleError(error: any) {
  const cause = error.cause ?? error
  const code = cause?.code ?? error.code

  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === '23505' || code === 'ER_DUP_ENTRY') {
    const fullMessage = cause?.message ?? error.message ?? ''
    // const fullMessage = 'SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: customers.phoneNumber'
    // Programatically extract the table name and column name from the full message
    let userFriendlyMessage = 'Operation failed'
    const errorData = {
      name: '',
      message: '',
    }
    if (fullMessage.includes('SQLITE_CONSTRAINT_UNIQUE')) {
      const [table, column] = fullMessage.split(' ').at(-1)!.split('.')
      userFriendlyMessage = `One of the ${table} with this ${column} already exists.`
      errorData.name = column
      errorData.message = 'This value must be unique but is already in use.'
    }
    else if (code === '23505') {
      const column = cause?.column ?? cause?.detail?.match(/\(([^)]+)\)=/)?.[1] ?? ''
      const table = cause?.table ?? cause?.constraint?.split('_').slice(0, -2).join('_') ?? 'records'
      userFriendlyMessage = `One of the ${table} with this ${column || 'value'} already exists.`
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

  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || code === '23503') {
    return {
      statusCode: 400,
      statusMessage: 'Cannot delete record because it is referenced by another record',
    }
  }

  if (code === '23502') {
    const column = cause?.column ?? ''
    return {
      statusCode: 400,
      statusMessage: 'Validation Error',
      stack: '',
      data: {
        message: `${column || 'A required field'} cannot be empty.`,
        errors: [{
          name: column,
          message: 'This field is required.',
        }],
      },
    }
  }

  if (code === '23514') {
    return {
      statusCode: 400,
      statusMessage: 'Validation Error',
      stack: '',
      data: {
        message: 'One of the submitted values violates a database constraint.',
        errors: [],
      },
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
