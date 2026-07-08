import { preloadAdminPgDriver } from '#layers/autoadmin/server/utils/db'

/**
 * Preloads the optional Postgres driver at startup so the synchronous
 * `useAdminDb()` can use it. The import is attempted unconditionally (a
 * Hyperdrive binding can appear at request time), but a missing `pg` package
 * is silently ignored and only surfaces if a Postgres connection is used.
 */
export default defineNitroPlugin(async () => {
  await preloadAdminPgDriver()
})
