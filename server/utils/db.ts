import process from 'node:process'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { getConfiguredAdminDialect } from './dialect'

let _db: ReturnType<typeof drizzleD1> | ReturnType<typeof drizzleLibsql> | ReturnType<typeof drizzlePg>
let _pgPool: Pool | undefined

export function useAdminDb() {
  if (!_db) {
    // const dbBinding = useEvent().context.cloudflare?.env?.DB
    const globalEnv = globalThis as typeof globalThis & { __env__?: { DB?: unknown }, DB?: unknown }
    const dbBinding = process.env.DB || globalEnv.__env__?.DB || globalEnv.DB
    if (dbBinding) {
      _db = drizzleD1(dbBinding, {
        casing: 'snake_case',
        // logger: true,
      })
      // eslint-disable-next-line no-console
      console.info('Using D1 database')
    }
    else {
      const config = useRuntimeConfig()
      if (config.databaseUrl) {
        const dialect = getConfiguredAdminDialect(config)
        if (dialect === 'postgresql') {
          _pgPool ??= new Pool({
            connectionString: config.databaseUrl as string,
          })
          _db = drizzlePg(_pgPool, {
            casing: 'snake_case',
            // logger: true,
          })
          // eslint-disable-next-line no-console
          console.info('Using PostgreSQL database')
        }
        else {
          _db = drizzleLibsql(config.databaseUrl as string, {
            casing: 'snake_case',
            // logger: true,
          })
          // eslint-disable-next-line no-console
          console.info('Using SQLite database')
        }
      }
      else {
        throw new Error('No database binding or configuration found for autoadmin.')
      }
    }
  }
  return _db
}

// export type AdminDbType = ReturnType<typeof useAdminDb>
export type AdminDbType = ReturnType<typeof drizzleLibsql>
