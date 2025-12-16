export function humanifyDateTime(date: string | Date, options: { includeTime?: boolean } = {}): string {
  if (!date) {
    return ''
  }

  if (typeof options.includeTime !== 'boolean') {
    options.includeTime = true
  }

  const inputDate = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const inputDateOnly = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate())

  // Format time in 12-hour format
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }
  const timeString = options.includeTime ? inputDate.toLocaleTimeString('en-US', timeOptions) : ''

  if (inputDateOnly.getTime() === today.getTime()) {
    return options.includeTime ? `Today at ${timeString}` : 'Today'
  } else if (inputDateOnly.getTime() === yesterday.getTime()) {
    return options.includeTime ? `Yesterday at ${timeString}` : 'Yesterday'
  } else {
    // Format as "Jul 3, 2025, 5:45 AM"
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
    const dateString = inputDate.toLocaleDateString('en-US', dateOptions)

    return options.includeTime ? `${dateString}, ${timeString}` : dateString
  }
}
