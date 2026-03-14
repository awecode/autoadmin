export type DatabaseDialect = 'sqlite' | 'postgresql'

const SQLITE_URL_PREFIXES = ['file:', 'libsql:', 'sqlite:']
const POSTGRES_URL_PREFIXES = ['postgres://', 'postgresql://']

export function getExplicitDialect(value: unknown): DatabaseDialect | undefined {
  if (value === 'sqlite' || value === 'postgresql') {
    return value
  }
}

export function getDialectFromUrl(url: string): DatabaseDialect | undefined {
  if (POSTGRES_URL_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return 'postgresql'
  }
  if (SQLITE_URL_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return 'sqlite'
  }
}
