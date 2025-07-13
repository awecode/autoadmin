import type { Column } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const createDateFilterCondition = (column: Column, value: string) => {
  // Handle date range filters - expects format "startDate,endDate"
  if (typeof value === 'string' && value.includes(',')) {
    const [startDate, endDate] = value.split(',')

    if (startDate && endDate) {
      // Both start and end dates provided
      const startOfDay = `${startDate} 00:00:00`
      const endOfDay = `${endDate} 23:59:59`

      return sql`${column} >= ${startOfDay} AND ${column} <= ${endOfDay}`
    } else if (startDate) {
      // Only start date provided
      const startOfDay = `${startDate} 00:00:00`

      return sql`${column} >= ${startOfDay}`
    } else if (endDate) {
      // Only end date provided
      const endOfDay = `${endDate} 23:59:59`
      return sql`${column} <= ${endOfDay}`
    }
  }
}
