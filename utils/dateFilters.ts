import type { Column } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const createDateFilterCondition = (column: Column, value: string, hasMs: boolean = false) => {
  // Handle date range filters - expects format "startDate,endDate"
  const isSqlite = column.columnType === 'SQLiteTimestamp'
  const divisor = hasMs ? 1 : 1000
  console.log('isSqlite', column.columnType)
  if (typeof value === 'string' && value.includes(',')) {
    const [startDate, endDate] = value.split(',')

    if (startDate && endDate) {
      // Both start and end dates provided
      if (isSqlite) {
        const startTimestamp = Math.floor(new Date(`${startDate} 00:00:00`).getTime() / divisor)
        const endTimestamp = Math.floor(new Date(`${endDate} 23:59:59`).getTime() / divisor)
        return sql`${column} >= ${startTimestamp} AND ${column} <= ${endTimestamp}`
      } else {
        const startOfDay = `${startDate} 00:00:00`
        const endOfDay = `${endDate} 23:59:59`
        return sql`${column} >= ${startOfDay} AND ${column} <= ${endOfDay}`
      }
    } else if (startDate) {
      // Only start date provided
      if (isSqlite) {
        const startTimestamp = Math.floor(new Date(`${startDate} 00:00:00`).getTime() / divisor)
        return sql`${column} >= ${startTimestamp}`
      } else {
        const startOfDay = `${startDate} 00:00:00`
        return sql`${column} >= ${startOfDay}`
      }
    } else if (endDate) {
      // Only end date provided
      if (isSqlite) {
        const endTimestamp = Math.floor(new Date(`${endDate} 23:59:59`).getTime() / divisor)
        return sql`${column} <= ${endTimestamp}`
      } else {
        const endOfDay = `${endDate} 23:59:59`
        return sql`${column} <= ${endOfDay}`
      }
    }
  }
}
