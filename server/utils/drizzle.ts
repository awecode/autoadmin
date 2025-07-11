import { z } from 'zod'

export const genericPaginationQuerySchema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().positive().max(
    100,
    `Page size must be less than or equal to 100`,
  ).default(10),
}).strip()

interface PaginatedResponse<T> {
  results: T[]
  pagination: {
    count: number
    page: number
    size: number
    pages: number
  }
}

export async function getPaginatedResponse<T>(
  baseQuery: any,
  countQuery: any,
  query: any,
): Promise<PaginatedResponse<T>> {
  const { page, size: pageSize } = genericPaginationQuerySchema.parse(query)
  const offset = (page - 1) * pageSize

  const [{ resultCount }] = await countQuery

  const results = await baseQuery
    .limit(pageSize)
    .offset(offset)

  return {
    results,
    pagination: {
      count: Number(resultCount),
      page,
      size: pageSize,
      pages: Math.ceil(Number(resultCount) / pageSize),
    },
  }
}

// Careful, this function exposes table names and column names in the error message
export function handleDrizzleError(error: any) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505' || error.code === 'ER_DUP_ENTRY') {
    const fullMessage = error.message
    // const fullMessage = 'SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: customers.phoneNumber'
    // Programatically extract the table name and column name from the full message
    let userFriendlyMessage = 'Operation failed'
    if (fullMessage.includes('SQLITE_CONSTRAINT_UNIQUE')) {
      // TODO Parse camelCase/snake_case column name to human readable
      const [table, column] = fullMessage.split(' ').at(-1).split('.')
      userFriendlyMessage = `One of the ${table} with this ${column} already exists`
    }
    return {
      statusCode: 400,
      message: userFriendlyMessage,
      statusMessage: 'Validation Error',
      stack: '',
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
