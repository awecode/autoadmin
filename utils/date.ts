export function humanifyDateTime(date: string | Date): string {
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
  const timeString = inputDate.toLocaleTimeString('en-US', timeOptions)

  if (inputDateOnly.getTime() === today.getTime()) {
    return `Today at ${timeString}`
  } else if (inputDateOnly.getTime() === yesterday.getTime()) {
    return `Yesterday at ${timeString}`
  } else {
    // Format as "Jul 20, 3:44 pm"
    const monthOptions: Intl.DateTimeFormatOptions = { month: 'short' }
    const month = inputDate.toLocaleDateString('en-US', monthOptions)
    const day = inputDate.getDate()

    return `${month} ${day}, ${timeString}`
  }
}
