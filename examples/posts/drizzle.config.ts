import process from 'node:process'
import { defineConfig } from 'drizzle-kit'
import 'dotenv/config'

const appDialect = process.env.NUXT_DATABASE_DIALECT === 'postgres' ? 'postgres' : 'sqlite'
const drizzleDialect = appDialect === 'postgres' ? 'postgresql' : 'sqlite'

export default defineConfig({
  out: `./server/db/migrations/${appDialect}`,
  schema: `./server/db/${appDialect}.ts`,
  dialect: drizzleDialect,
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL!,
  },
})
