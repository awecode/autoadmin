import process from 'node:process'
import { fileURLToPath } from 'node:url'

const adminUrlPrefix = process.env.NUXT_PUBLIC_AUTOADMIN_URL_PREFIX || '/admin'
const apiPrefix = process.env.NUXT_PUBLIC_API_PREFIX || '/api/autoadmin'

export default defineNuxtConfig({
  runtimeConfig: {
    adminUrlPrefix,
    auth: {
      adminOnlyApiRoutes: '/api/autoadmin',
    },
    public: {
      apiPrefix,
      autoadmin: {
        title: 'AutoAdmin',
      },
      pagination: {
        defaultSize: 20,
        maxSize: 200,
      },
    },
    databaseUrl: '',
    s3: {
      accessKey: process.env.NUXT_S3_ACCESS_KEY || '',
      secretKey: process.env.NUXT_S3_SECRET_KEY || '',
      bucketName: process.env.NUXT_S3_BUCKET_NAME || '',
      endpointUrl: process.env.NUXT_S3_ENDPOINT_URL || '',
      region: process.env.NUXT_S3_REGION || 'us-east-1',
      publicUrl: process.env.NUXT_S3_PUBLIC_URL || '',
    },
  },
  css: [fileURLToPath(new URL('./assets/css/main.css', import.meta.url))],
  modules: [
    '@nuxt/ui',
  ],
  build: {
    transpile: ['vue'],
  },
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
