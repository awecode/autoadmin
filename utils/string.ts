import { defu } from 'defu'

export function useTitleCase(str: string): string {
  return str.replace(/\w\S*/g, txt =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
}

export function toTitleCase(str: string): string {
  return str.split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const defaultIconMap: Record<string, string> = {
  user: 'user-circle',
  profile: 'user-circle',

  product: 'box',
  item: 'package',

  order: 'receipt',
  purchase: 'shopping-cart',

  invoice: 'file-text',

  payment: 'credit-card',
  transaction: 'dollar-sign',

  category: 'layers',
  collection: 'folder',

  tag: 'tag',

  role: 'shield',
  permission: 'key',
  group: 'users',

  file: 'file',
  media: 'image',
  image: 'image',
  document: 'file-text',
  attachment: 'paperclip',

  setting: 'settings',
  preference: 'sliders',

  log: 'scroll',
  activity: 'activity',
  audit: 'list',

  notification: 'bell',
  message: 'message-circle',
  comment: 'message-square',
  chat: 'message-circle',

  location: 'map-pin',
  address: 'map',

  device: 'smartphone',

  feedback: 'message-circle',
  contact: 'phone',

  subscription: 'repeat',
  plan: 'calendar',

  campaign: 'megaphone',

  report: 'bar-chart',
  stat: 'pie-chart',
  metric: 'gauge',

  schedule: 'calendar-clock',
  task: 'check-square',
  todo: 'list-todo',

  team: 'users',
  member: 'user',

  job: 'briefcase',
  career: 'briefcase',

  ticket: 'ticket',

  faq: 'help-circle',

  blog: 'pen-line',
  post: 'file-text',
  article: 'newspaper',

  banner: 'image',
  ad: 'badge-dollar-sign',

  seo: 'search',
  sitemap: 'sitemap',
}

export function getIconForLabel(name: string): string {
  const singular = toSingular(name.toLowerCase())
  const iconMap = defu(defaultIconMap) as Record<string, string>
  return `i-lucide-${iconMap[singular] ?? 'database'}`
}

// Naive plural → singular converter
function toSingular(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}
