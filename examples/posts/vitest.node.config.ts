import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const playgroundRoot = fileURLToPath(new URL('../..', import.meta.url))

/** Node-only config for helper tests that do not need the Nuxt test environment. */
export default defineConfig({
  resolve: {
    alias: {
      '#layers/autoadmin': playgroundRoot,
      '#autoadmin/roleAccess': `${playgroundRoot}/server/utils/roleAccess.ts`,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/self-ref-fk.test.ts', 'tests/audit-helpers.test.ts', 'tests/postgres-support.test.ts'],
  },
})
