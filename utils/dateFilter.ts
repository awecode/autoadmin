import type { Column } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const createDateRangeFilterCondition = (column: Column, value: string, hasMs: boolean = false) => {
  // Handle date range filters - expects format "startDate,endDate"
  const isSqlite = column.columnType === 'SQLiteTimestamp'
  const divisor = hasMs ? 1 : 1000
  if (typeof value === 'string' && value.includes(',')) {
    const [startDate, endDate] = value.split(',')

    if (startDate && endDate) {
      // Both start and end dates provided
      if (isSqlite) {
        const startDateTime = new Date(`${startDate} 00:00:00`)
        const endDateTime = new Date(`${endDate} 23:59:59`)

        // Validate dates
        if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
          return undefined
        }

        const startTimestamp = Math.floor(startDateTime.getTime() / divisor)
        const endTimestamp = Math.floor(endDateTime.getTime() / divisor)
        return sql`${column} >= ${startTimestamp} AND ${column} <= ${endTimestamp}`
      } else {
        const startOfDay = `${startDate} 00:00:00`
        const endOfDay = `${endDate} 23:59:59`
        return sql`${column} >= ${startOfDay} AND ${column} <= ${endOfDay}`
      }
    } else if (startDate) {
      // Only start date provided
      if (isSqlite) {
        const startDateTime = new Date(`${startDate} 00:00:00`)

        // Validate date
        if (Number.isNaN(startDateTime.getTime())) {
          return undefined
        }

        const startTimestamp = Math.floor(startDateTime.getTime() / divisor)
        return sql`${column} >= ${startTimestamp}`
      } else {
        const startOfDay = `${startDate} 00:00:00`
        return sql`${column} >= ${startOfDay}`
      }
    } else if (endDate) {
      // Only end date provided
      if (isSqlite) {
        const endDateTime = new Date(`${endDate} 23:59:59`)

        // Validate date
        if (Number.isNaN(endDateTime.getTime())) {
          return undefined
        }

        const endTimestamp = Math.floor(endDateTime.getTime() / divisor)
        return sql`${column} <= ${endTimestamp}`
      } else {
        const endOfDay = `${endDate} 23:59:59`
        return sql`${column} <= ${endOfDay}`
      }
    }
  }
}

export const createDateFilterCondition = (column: Column, value: string, hasMs: boolean = false) => {
  // Handle single date filter - expects format "YYYY-MM-DD"
  const isSqlite = column.columnType === 'SQLiteTimestamp'
  const divisor = hasMs ? 1 : 1000

  if (typeof value === 'string' && value.trim() !== '') {
    // Validate date format first
    const startDate = new Date(`${value} 00:00:00`)
    const endDate = new Date(`${value} 23:59:59`)

    // Check if dates are valid
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return undefined // Return undefined for invalid dates
    }

    // Single date - match the entire day
    if (isSqlite) {
      const startTimestamp = Math.floor(startDate.getTime() / divisor)
      const endTimestamp = Math.floor(endDate.getTime() / divisor)
      return sql`${column} >= ${startTimestamp} AND ${column} <= ${endTimestamp}`
    } else {
      // TODO Other dialects can directly use the date string without the time
      const startOfDay = `${value} 00:00:00`
      const endOfDay = `${value} 23:59:59`
      return sql`${column} >= ${startOfDay} AND ${column} <= ${endOfDay}`
    }
  }
}
