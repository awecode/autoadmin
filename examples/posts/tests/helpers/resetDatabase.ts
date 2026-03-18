import process from 'node:process'
import { Pool } from 'pg'
import { getDialectFromUrl } from '../../../../utils/databaseDialect'
import 'dotenv/config'

export async function resetDatabase() {
  const databaseUrl = process.env.NUXT_DATABASE_URL
  if (!databaseUrl) {
    throw new Error('NUXT_DATABASE_URL is not set')
  }

  const dialect = getDialectFromUrl(databaseUrl) ?? 'sqlite'

  if (dialect === 'postgresql') {
    const pool = new Pool({ connectionString: databaseUrl })
    try {
      await pool.query('TRUNCATE TABLE posts_to_tags, posts, tags, users, categories RESTART IDENTITY CASCADE')
    }
    finally {
      await pool.end()
    }
  }
}
