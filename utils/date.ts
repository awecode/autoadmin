/**
 * Format a date in the runtime's local timezone (Today / Yesterday when applicable).
 * Prefer `HumanifyDateTime` in SSR templates to avoid hydration warnings.
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
