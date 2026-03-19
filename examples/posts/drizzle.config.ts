import process from 'node:process'
import { defineConfig } from 'drizzle-kit'
import { getDialectFromUrl } from '../../utils/databaseDialect'
import 'dotenv/config'

if (!process.env.NUXT_DATABASE_URL) {
  throw new Error('NUXT_DATABASE_URL is not set')
}

const appDialect = getDialectFromUrl(process.env.NUXT_DATABASE_URL) ?? 'sqlite'

export default defineConfig({
  out: `./server/db/migrations/${appDialect}`,
  schema: `./server/db/${appDialect}.ts`,
  dialect: appDialect,
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL!,
  },
})
