import process from 'node:process'
import { createClient } from '@libsql/client'
import { Pool } from 'pg'
import { getDialectFromUrl } from '../../../../utils/databaseDialect'
import 'dotenv/config'

const SQLITE_TABLES = [
  'posts_to_tags',
  'posts',
  'tags',
  'users',
  'categories',
  'autoadmin_audit_logs',
] as const

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
      // Owned by AutoAdmin (created on first audit write); ignore if not present yet.
      try {
        await pool.query('TRUNCATE TABLE autoadmin_audit_logs RESTART IDENTITY CASCADE')
      }
      catch (error) {
        if ((error as { code?: string }).code !== '42P01') {
          throw error
        }
      }
    }
    finally {
      await pool.end()
    }
    return
  }

  const client = createClient({ url: databaseUrl })
  try {
    await client.execute('PRAGMA foreign_keys = OFF')
    for (const table of SQLITE_TABLES) {
      try {
        await client.execute(`DELETE FROM ${table}`)
      }
      catch (error) {
        const message = String((error as { message?: string })?.message ?? error)
        // Audit table is created lazily on first write.
        if (table === 'autoadmin_audit_logs' && /no such table/i.test(message)) {
          continue
        }
        throw error
      }
    }
    try {
      await client.execute(
        `DELETE FROM sqlite_sequence WHERE name IN (${SQLITE_TABLES.map(t => `'${t}'`).join(', ')})`,
      )
    }
    catch (error) {
      const message = String((error as { message?: string })?.message ?? error)
      if (!/no such table/i.test(message)) {
        throw error
      }
    }
    await client.execute('PRAGMA foreign_keys = ON')
  }
  finally {
    client.close()
  }
}
