/**
 * Build-time stub used when `@libsql/client` is not installed in the consumer.
 * Nitro traces `drizzle-orm/libsql` even for Postgres/D1 apps; Cloudflare cannot
 * leave unresolved packages as externals. This keeps the optional peer contract.
 */
function missing() {
  throw new Error(
    'AutoAdmin: "@libsql/client" is not installed. Install it to use SQLite/libsql, e.g. `npx nypm add @libsql/client`.',
  )
}

export function createClient() {
  missing()
}

export default { createClient }
