import { createRequire } from 'node:module'
import { join } from 'node:path'

const OPTIONAL_DRIVERS = [
  { id: '@libsql/client', stub: 'libsql-client.mjs' },
  { id: 'pg', stub: 'pg.mjs' },
] as const

function canResolveFromApp(id: string): boolean {
  try {
    createRequire(join(process.cwd(), 'package.json')).resolve(id)
    return true
  }
  catch {
    return false
  }
}

/**
 * Alias optional DB drivers to stubs when the consumer has not installed them.
 * Lets Nitro/Cloudflare builds succeed for apps that only use one backend.
 *
 * @param layerRoot Absolute path to the autoadmin layer root (directory with nuxt.config).
 */
export function optionalDriverAliases(layerRoot: string): Record<string, string> {
  const stubDir = join(layerRoot, 'server/stubs')
  const aliases: Record<string, string> = {}

  for (const { id, stub } of OPTIONAL_DRIVERS) {
    if (!canResolveFromApp(id)) {
      aliases[id] = join(stubDir, stub)
    }
  }

  return aliases
}
