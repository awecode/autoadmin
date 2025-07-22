import { fileURLToPath } from 'node:url'

const adminUrlPrefix = process.env.NUXT_AUTOADMIN_URL_PREFIX || '/admin'

export default defineNuxtConfig({
  extends: ['..'],
  modules: ['@nuxt/eslint'],
  eslint: {
    config: {
      // Use the generated ESLint config for lint root project as well
      rootDir: fileURLToPath(new URL('..', import.meta.url)),
    },
  },
  runtimeConfig: {
    adminUrlPrefix,
    public: {
      apiPrefix: '/api/autoadmin',
      autoAdmin: {
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
        path: `${adminUrlPrefix}/`,
        file: '#layers/automadmin/pages/_autoadmin/index.vue',
      })
      pages.push({
        name: 'autoadmin-list',
        path: `${adminUrlPrefix}/:modelLabel/`,
        file: '#layers/automadmin/pages/_autoadmin/list/index.vue',
      })
      pages.push({
        name: 'autoadmin-create',
        path: `${adminUrlPrefix}/:modelLabel/create`,
        file: '#layers/automadmin/pages/_autoadmin/create/index.vue',
      })
      pages.push({
        name: 'autoadmin-update',
        path: `${adminUrlPrefix}/:modelLabel/update/:lookupValue`,
        file: '#layers/automadmin/pages/_autoadmin/update/index.vue',
      })
    },
  },
})
