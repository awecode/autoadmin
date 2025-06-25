import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  extends: ['..'],
  modules: ['@nuxt/eslint'],
  eslint: {
    config: {
      // Use the generated ESLint config for lint root project as well
      rootDir: fileURLToPath(new URL('..', import.meta.url))
    }
  },
  $meta: {
    name: 'autoadmin',
  },
  alias: {
    '#layers/automadmin': fileURLToPath(new URL('.', import.meta.url))
  },
  hooks: {
    'pages:extend': function (pages) {
      pages.push({
        name: 'list',
        path: '/:modelLabel(.+)/',
        file: '#layers/automadmin/pages/list/index.vue',
      })
    }
  }
})
