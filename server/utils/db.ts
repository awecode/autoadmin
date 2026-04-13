import process from 'node:process'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { getConfiguredAdminDialect } from './dialect'

export type AdminDbDialect = 'sqlite' | 'postgresql' | 'd1'

export interface HyperdriveBinding { connectionString?: string }

type DBType = ReturnType<typeof drizzleD1> | ReturnType<typeof drizzleLibsql> | ReturnType<typeof drizzlePg>

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
const logDb: boolean = false

export function useAdminDb(): AdminDbType {
  if (!_db) {
    // const dbBinding = useEvent().context.cloudflare?.env?.DB
    const globalEnv = globalThis as typeof globalThis & {
      __env__?: { DB?: unknown, HYPERDRIVE?: HyperdriveBinding, HYPERDRIVE_NO_CACHE?: HyperdriveBinding }
      DB?: unknown
      HYPERDRIVE?: HyperdriveBinding
      HYPERDRIVE_NO_CACHE?: HyperdriveBinding
    }
    const dbBinding = process.env.DB || globalEnv.__env__?.DB || globalEnv.DB
    if (dbBinding) {
      _db = drizzleD1(dbBinding, {
        casing: 'snake_case',
        logger: logDb,
      })
      // eslint-disable-next-line no-console
      console.info('Using D1 database')
    }
    else {
      const config = useRuntimeConfig()
      let hyperdriveBinding: HyperdriveBinding | undefined
      const hyperdriveNoCacheBinding = (process.env.HYPERDRIVE_NO_CACHE || globalEnv.__env__?.HYPERDRIVE_NO_CACHE || globalEnv.HYPERDRIVE_NO_CACHE) as HyperdriveBinding | undefined
      if (hyperdriveNoCacheBinding && hyperdriveNoCacheBinding.connectionString) {
        hyperdriveBinding = hyperdriveNoCacheBinding
      }
      else {
        hyperdriveBinding = (process.env.HYPERDRIVE || globalEnv.__env__?.HYPERDRIVE || globalEnv.HYPERDRIVE) as HyperdriveBinding | undefined
      }
      if (hyperdriveBinding && hyperdriveBinding.connectionString) {
        // eslint-disable-next-line no-console
        console.info('Using PostgreSQL database via Hyperdrive')
        return drizzlePg({
          connection: {
            connectionString: hyperdriveBinding.connectionString,
          },
          casing: 'snake_case',
          logger: logDb,
        }) as unknown as AdminDbType
      }
      else if (config.databaseUrl) {
        const dialect = getConfiguredAdminDialect(config)
        if (dialect === 'postgresql') {
          // eslint-disable-next-line no-console
          console.info('Using PostgreSQL database')
          return drizzlePg({
            connection: {
              connectionString: config.databaseUrl as string,
            },
            casing: 'snake_case',
            logger: logDb,
          }) as unknown as AdminDbType
        }
        else {
          _db = drizzleLibsql(config.databaseUrl as string, {
            casing: 'snake_case',
            logger: logDb,
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
