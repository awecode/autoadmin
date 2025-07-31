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
  css: [fileURLToPath(new URL('./assets/css/main.css', import.meta.url))],
  modules: [
    '@nuxt/ui',
  ],
  $meta: {
    name: 'autoadmin',
  },
  alias: {
    '#layers/autoadmin': fileURLToPath(new URL('.', import.meta.url)),
  },
  hooks: {
    'pages:extend': function (pages) {
      pages.push({
        name: 'autoadmin-index',
        path: adminUrlPrefix,
        file: '#layers/autoadmin/pages/_autoadmin/index.vue',
      })
      pages.push({
        name: 'autoadmin-list',
        path: `${adminUrlPrefix}/:modelKey`,
        file: '#layers/autoadmin/pages/_autoadmin/list.vue',
      })
      pages.push({
        name: 'autoadmin-create',
        path: `${adminUrlPrefix}/:modelKey/create`,
        file: '#layers/autoadmin/pages/_autoadmin/create.vue',
      })
      pages.push({
        name: 'autoadmin-update',
        path: `${adminUrlPrefix}/:modelKey/update/:lookupValue`,
        file: '#layers/autoadmin/pages/_autoadmin/update.vue',
      })
    },
  },
})
