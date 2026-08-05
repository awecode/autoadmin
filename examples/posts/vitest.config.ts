import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const playgroundRoot = fileURLToPath(new URL('../..', import.meta.url))

// Node env for unit + @nuxt/test-utils/e2e (host) suites.
// Avoid defineVitestConfig / environment: 'nuxt' until Vitest 4: Vitest 3's Vite 7
// plus Nuxt 4's Vite 8 plugins causes Missing field `moduleType` worker crashes.
export default defineConfig({
  resolve: {
    alias: {
      '#layers/autoadmin': playgroundRoot,
      '#autoadmin/roleAccess': `${playgroundRoot}/server/utils/roleAccess.ts`,
    },
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
  },
})
