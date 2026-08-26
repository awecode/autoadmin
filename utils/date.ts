/**
 * Format a date in the runtime's local timezone (Today / Yesterday when applicable).
 * Do not interpolate this into SSR templates — use `HumanifyDateTime` instead.
 */
export function humanifyDateTime(date: string | Date, opts: { includeTime?: boolean } = {}): string {
  if (!date) {
    return ''
  }

  const includeTime = typeof opts.includeTime === 'boolean' ? opts.includeTime : true
  const inputDate = new Date(date)
  if (Number.isNaN(inputDate.getTime())) {
    return String(date)
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const inputDateOnly = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate())

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }
  const timeString = includeTime ? inputDate.toLocaleTimeString('en-US', timeOptions) : ''

  if (inputDateOnly.getTime() === today.getTime()) {
    return includeTime ? `Today at ${timeString}` : 'Today'
  }
  if (inputDateOnly.getTime() === yesterday.getTime()) {
    return includeTime ? `Yesterday at ${timeString}` : 'Yesterday'
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
  const dateString = inputDate.toLocaleDateString('en-US', dateOptions)

  return includeTime ? `${dateString}, ${timeString}` : dateString
}

/** UTC formatting for plain strings that must match between SSR and client. */
export function formatDateTimeUTC(date: string | Date, opts: { includeTime?: boolean } = {}): string {
  if (!date) {
    return ''
  }

  const includeTime = typeof opts.includeTime === 'boolean' ? opts.includeTime : true
  const inputDate = new Date(date)
  if (Number.isNaN(inputDate.getTime())) {
    return String(date)
  }

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }
  if (includeTime) {
    options.hour = 'numeric'
    options.minute = '2-digit'
    options.hour12 = true
    options.timeZoneName = 'short'
  }

  return inputDate.toLocaleString('en-US', options)
}
