/**
 * Build-time stub used when `pg` is not installed in the consumer.
 * Nitro traces `drizzle-orm/node-postgres` even for D1/libsql apps; Cloudflare cannot
 * leave unresolved packages as externals. This keeps the optional peer contract.
 */
function missing() {
  throw new Error(
    'AutoAdmin: "pg" is not installed. Install it to use PostgreSQL, e.g. `npx nypm add pg`.',
  )
}

export class Pool {
  constructor() {
    missing()
  }
}

export class Client {
  constructor() {
    missing()
  }
}

const pg = { Pool, Client }
export default pg
