import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './server/db/migrations',
  schema: './server/db/schema.ts',
  dialect: 'sqlite',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL!,
  },
})