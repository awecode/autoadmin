import type { drizzle as DrizzleLibsqlFn } from 'drizzle-orm/libsql'
import type { drizzle as DrizzlePgFn } from 'drizzle-orm/node-postgres'
import process from 'node:process'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { getConfiguredAdminDialect } from './dialect'

export type AdminDbDialect = 'sqlite' | 'postgresql' | 'd1'

export interface HyperdriveBinding { connectionString?: string }

type DrizzlePg = typeof DrizzlePgFn
type DrizzleLibsql = typeof DrizzleLibsqlFn

type DBType = ReturnType<typeof drizzleD1> | ReturnType<DrizzleLibsql> | ReturnType<DrizzlePg>

let pgDriver: DrizzlePg | undefined
let pgDriverFailed = false
let pgDriverLoadError: unknown

let libsqlDriver: DrizzleLibsql | undefined
let libsqlDriverFailed = false
let libsqlDriverLoadError: unknown

async function ensurePgDriver(): Promise<DrizzlePg> {
  if (pgDriver) {
    return pgDriver
  }
  if (pgDriverFailed) {
    throw new Error(
      'AutoAdmin: a PostgreSQL connection was configured, but the "pg" package could not be loaded. Install it in your project, e.g. `npx nypm add pg`.',
      { cause: pgDriverLoadError },
    )
  }

  try {
    const mod = await import('drizzle-orm/node-postgres')
    pgDriver = mod.drizzle
    return pgDriver
  }
  catch (error) {
    pgDriverFailed = true
    pgDriverLoadError = error
    throw new Error(
      'AutoAdmin: a PostgreSQL connection was configured, but the "pg" package could not be loaded. Install it in your project, e.g. `npx nypm add pg`.',
      { cause: error },
    )
  }
}

async function ensureLibsqlDriver(): Promise<DrizzleLibsql> {
  if (libsqlDriver) {
    return libsqlDriver
  }
  if (libsqlDriverFailed) {
    throw new Error(
      'AutoAdmin: a SQLite/libsql connection was configured, but the "@libsql/client" package could not be loaded. Install it in your project, e.g. `npx nypm add @libsql/client`.',
      { cause: libsqlDriverLoadError },
    )
  }

  try {
    const mod = await import('drizzle-orm/libsql')
    libsqlDriver = mod.drizzle
    return libsqlDriver
  }
  catch (error) {
    libsqlDriverFailed = true
    libsqlDriverLoadError = error
    throw new Error(
      'AutoAdmin: a SQLite/libsql connection was configured, but the "@libsql/client" package could not be loaded. Install it in your project, e.g. `npx nypm add @libsql/client`.',
      { cause: error },
    )
  }
}

export interface AutoAdminDbTypes {}

type ResolvedAdminDbDialect = AutoAdminDbTypes extends { dialect: infer D }
  ? D extends AdminDbDialect
    ? D
    : 'sqlite'
  : 'sqlite'

export type AdminDbTypeForDialect<D extends AdminDbDialect> = D extends 'postgresql'
  ? ReturnType<DrizzlePg>
  : D extends 'd1'
    ? ReturnType<typeof drizzleD1>
    : ReturnType<DrizzleLibsql>

export type AdminDbType = AdminDbTypeForDialect<ResolvedAdminDbDialect>

let _db: DBType | undefined
let _dbPromise: Promise<DBType> | undefined
const logDb: boolean = false

function getGlobalEnv() {
  return globalThis as typeof globalThis & {
    __env__?: { DB?: unknown, HYPERDRIVE?: HyperdriveBinding, HYPERDRIVE_NO_CACHE?: HyperdriveBinding }
    DB?: unknown
    HYPERDRIVE?: HyperdriveBinding
    HYPERDRIVE_NO_CACHE?: HyperdriveBinding
  }
}

async function createAdminDb(): Promise<DBType> {
  const globalEnv = getGlobalEnv()
  const dbBinding = process.env.DB || globalEnv.__env__?.DB || globalEnv.DB
  if (dbBinding) {
    // eslint-disable-next-line no-console
    console.info('Using D1 database')
    return drizzleD1(dbBinding, {
      casing: 'snake_case',
      logger: logDb,
    })
  }

  const config = useRuntimeConfig()
  let hyperdriveBinding: HyperdriveBinding | undefined
  const hyperdriveNoCacheBinding = (process.env.HYPERDRIVE_NO_CACHE || globalEnv.__env__?.HYPERDRIVE_NO_CACHE || globalEnv.HYPERDRIVE_NO_CACHE) as HyperdriveBinding | undefined
  if (hyperdriveNoCacheBinding?.connectionString) {
    hyperdriveBinding = hyperdriveNoCacheBinding
  }
  else {
    hyperdriveBinding = (process.env.HYPERDRIVE || globalEnv.__env__?.HYPERDRIVE || globalEnv.HYPERDRIVE) as HyperdriveBinding | undefined
  }

  if (hyperdriveBinding?.connectionString) {
    const drizzlePg = await ensurePgDriver()
    // eslint-disable-next-line no-console
    console.info('Using PostgreSQL database via Hyperdrive')
    return drizzlePg({
      connection: {
        connectionString: hyperdriveBinding.connectionString,
      },
      casing: 'snake_case',
      logger: logDb,
    })
  }

  if (config.databaseUrl) {
    const dialect = getConfiguredAdminDialect(config)
    if (dialect === 'postgresql') {
      const drizzlePg = await ensurePgDriver()
      // eslint-disable-next-line no-console
      console.info('Using PostgreSQL database')
      return drizzlePg({
        connection: {
          connectionString: config.databaseUrl as string,
        },
        casing: 'snake_case',
        logger: logDb,
      })
    }

    const drizzleLibsql = await ensureLibsqlDriver()
    // eslint-disable-next-line no-console
    console.info('Using SQLite database')
    return drizzleLibsql(config.databaseUrl as string, {
      casing: 'snake_case',
      logger: logDb,
    })
  }

  throw new Error('No database binding or configuration found for autoadmin.')
}

/**
 * Returns the admin database connection. Driver packages (`pg`, `@libsql/client`)
 * are loaded on demand for the configured dialect only — D1 workers never import them.
 */
export async function useAdminDb(): Promise<AdminDbType> {
  if (_db) {
    return _db as AdminDbType
  }

  if (!_dbPromise) {
    _dbPromise = createAdminDb()
      .then((db) => {
        _db = db
        return db
      })
      .catch((error) => {
        _dbPromise = undefined
        throw error
      })
  }

  const db = await _dbPromise
  return db as AdminDbType
}
