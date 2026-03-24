import process from 'node:process'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { getConfiguredAdminDialect } from './dialect'

export type AdminDbDialect = 'sqlite' | 'postgresql' | 'd1'

type DBType = ReturnType<typeof drizzleD1> | ReturnType<typeof drizzleLibsql> | ReturnType<typeof drizzlePg>
type HyperdriveBinding = { connectionString?: string }
type HyperdriveBindingLike = string | HyperdriveBinding | undefined | null

export interface AutoAdminDbTypes {}

type ResolvedAdminDbDialect = AutoAdminDbTypes extends { dialect: infer D }
  ? D extends AdminDbDialect
    ? D
    : 'sqlite'
  : 'sqlite'

export type AdminDbTypeForDialect<D extends AdminDbDialect> = D extends 'postgresql'
  ? ReturnType<typeof drizzlePg>
  : D extends 'd1'
    ? ReturnType<typeof drizzleD1>
    : ReturnType<typeof drizzleLibsql>

export type AdminDbType = AdminDbTypeForDialect<ResolvedAdminDbDialect>

let _db: DBType

export function getHyperdriveConnectionString(binding: HyperdriveBindingLike) {
  if (typeof binding === 'string') {
    return binding
  }
  return binding?.connectionString
}

export function useAdminDb() {
  if (!_db) {
    // const dbBinding = useEvent().context.cloudflare?.env?.DB
    const globalEnv = globalThis as typeof globalThis & {
      __env__?: { DB?: unknown, HYPERDRIVE?: HyperdriveBindingLike }
      DB?: unknown
      HYPERDRIVE?: HyperdriveBindingLike
    }
    const dbBinding = process.env.DB || globalEnv.__env__?.DB || globalEnv.DB
    const hyperdriveConnectionString = getHyperdriveConnectionString(
      process.env.HYPERDRIVE || globalEnv.__env__?.HYPERDRIVE || globalEnv.HYPERDRIVE,
    )
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
      if (hyperdriveConnectionString) {
        _db = drizzlePg({
          connection: {
            connectionString: hyperdriveConnectionString,
          },
          casing: 'snake_case',
          // logger: true,
        })
        // eslint-disable-next-line no-console
        console.info('Using PostgreSQL database via Hyperdrive')
      }
      else if (config.databaseUrl) {
        const dialect = getConfiguredAdminDialect(config)
        if (dialect === 'postgresql') {
          _db = drizzlePg({
            connection: {
              connectionString: config.databaseUrl as string,
            },
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
  return _db as AdminDbType
}
