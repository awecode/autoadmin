import type { DrizzleD1Database } from 'drizzle-orm/d1'
import process from 'node:process'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle } from 'drizzle-orm/libsql'

let _db: DrizzleD1Database

export function useAdminDb() {
  if (!_db) {
    // const dbBinding = useEvent().context.cloudflare?.env?.DB
    const dbBinding = process.env.DB
    if (dbBinding) {
      _db = drizzleD1(dbBinding, {
        casing: 'snake_case',
        // logger: true,
      })
    } else {
      const config = useRuntimeConfig()
      if (config.databaseUrl) {
        _db = drizzle(config.databaseUrl as string, {
          casing: 'snake_case',
          // logger: true,
        })
      } else {
        throw new Error('No database binding or configuration found.')
      }
    }
  }
  return _db
}

export type AdminDbType = ReturnType<typeof useAdminDb>
