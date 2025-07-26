import process from 'node:process'
import { fileURLToPath } from 'node:url'

const adminUrlPrefix = process.env.NUXT_PUBLIC_AUTOADMIN_URL_PREFIX || '/admin'
const apiPrefix = process.env.NUXT_PUBLIC_API_PREFIX || '/api/autoadmin'

export default defineNuxtConfig({
  runtimeConfig: {
    adminUrlPrefix,
    public: {
      apiPrefix,
      autoadmin: {
        title: 'AutoAdmin',
      },
    },
    databaseUrl: '',
    s3: {
      accessKey: undefined,
      secretKey: undefined,
      bucketName: undefined,
      endpointUrl: undefined,
      region: 'us-east-1',
      publicUrl: undefined,
    },
  },
  extends: ['..'],
  css: [fileURLToPath(new URL('./assets/css/main.css', import.meta.url))],
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/ui',
  ],
  eslint: {
    config: {
      // Use the generated ESLint config for lint root project as well
      rootDir: fileURLToPath(new URL('..', import.meta.url)),
    },
  },
  $meta: {
    name: 'autoadmin',
  },
  alias: {
    '#layers/automadmin': fileURLToPath(new URL('.', import.meta.url)),
  },
  hooks: {
    'pages:extend': function (pages) {
      pages.push({
        name: 'autoadmin-index',
        path: `${adminUrlPrefix}`,
        file: '#layers/automadmin/pages/_autoadmin/index.vue',
      })
      pages.push({
        name: 'autoadmin-list',
        path: `${adminUrlPrefix}/:modelLabel`,
        file: '#layers/automadmin/pages/_autoadmin/list.vue',
      })
      pages.push({
        name: 'autoadmin-create',
        path: `${adminUrlPrefix}/:modelLabel/create`,
        file: '#layers/automadmin/pages/_autoadmin/create.vue',
      })
      pages.push({
        name: 'autoadmin-update',
        path: `${adminUrlPrefix}/:modelLabel/update/:lookupValue`,
        file: '#layers/automadmin/pages/_autoadmin/update.vue',
      })
    },
  },
})
