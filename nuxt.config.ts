import process from 'node:process'
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  runtimeConfig: {
    auth: {
      adminOnlyApiRoutes: '/api/autoadmin',
    },
    autoadmin: {
      autoUniqueSlugs: true,
      /** JSON-admin GitHub storage defaults */
      github: {
        token: process.env.NUXT_AUTOADMIN_GITHUB_TOKEN || '',
        owner: process.env.NUXT_AUTOADMIN_GITHUB_OWNER || '',
        repo: process.env.NUXT_AUTOADMIN_GITHUB_REPO || '',
        ref: process.env.NUXT_AUTOADMIN_GITHUB_REF || '', // default branch of the repo is used when not specified
      },
      /** JSON-admin local storage root */
      jsonLocalRoot: process.env.NUXT_AUTOADMIN_JSON_LOCAL_ROOT || '',
      fileUploadRoles: process.env.NUXT_AUTOADMIN_FILE_UPLOAD_ROLES?.split(',') ?? [],
    },
    public: {
      autoadmin: {
        title: 'AutoAdmin',
        apiPrefix: process.env.NUXT_PUBLIC_AUTOADMIN_API_PREFIX || '/api/autoadmin',
        pathPrefix: process.env.NUXT_PUBLIC_AUTOADMIN_PATH_PREFIX || '/admin',
        jsonadmin: {
          /** Override JSON-admin API base (no trailing slash). Empty → `{apiPrefix}/json` */
          jsonApiPrefix: process.env.NUXT_PUBLIC_AUTOADMIN_JSONADMIN_JSON_API_PREFIX || '',
          linkLabel: process.env.NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_LABEL || 'Configuration',
          linkIcon: process.env.NUXT_PUBLIC_AUTOADMIN_JSONADMIN_LINK_ICON || 'i-lucide-settings-2',
          injectSidebar: process.env.NUXT_PUBLIC_AUTOADMIN_JSONADMIN_INJECT_SIDEBAR !== 'false',
          showDashboardCard: process.env.NUXT_PUBLIC_AUTOADMIN_JSONADMIN_SHOW_DASHBOARD_CARD !== 'false',
          takeoverMode: process.env.NUXT_PUBLIC_AUTOADMIN_JSONADMIN_TAKEOVER_MODE || 'auto',
        },
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
    r2PublicUrl: process.env.NUXT_R2_PUBLIC_URL || '',
  },
  css: [fileURLToPath(new URL('./assets/css/main.css', import.meta.url))],
  modules: [
    '@nuxt/ui',
  ],
  build: {
    transpile: ['vue'],
  },
  nitro: {
    esbuild: {
      options: {
        target: 'es2022',
      },
    },
    rollupConfig: {
      external: ['pg-native', 'cloudflare:sockets'],
    },
  },
  vite: {
    optimizeDeps: {
      include: [
        'prosemirror-keymap',
        'prosemirror-model',
        'prosemirror-state',
        'prosemirror-tables',
        'prosemirror-transform',
        'prosemirror-view',
      ],
    },
  },
  $meta: {
    name: 'autoadmin',
  },
  alias: {
    '#layers/autoadmin': fileURLToPath(new URL('.', import.meta.url)),
    /** Override in consuming app to customize `getUserRoleFromEvent` / `assertRoleAccessAllowed`. */
    '#autoadmin/roleAccess': fileURLToPath(new URL('./server/utils/roleAccess.ts', import.meta.url)),
  },
  hooks: {
    'pages:extend': function (pages) {
      // These are executed at build time.
      // TODO Move this to a plugin to make it work for runtime.
      const adminPathPrefix = process.env.NUXT_PUBLIC_AUTOADMIN_PATH_PREFIX || '/admin'
      const jsonBase = `${adminPathPrefix}/json`
      pages.push({
        name: 'jsonadmin-index',
        path: jsonBase,
        file: '#layers/autoadmin/pages/_jsonadmin/index.vue',
      })
      pages.push({
        name: 'jsonadmin-object-edit',
        path: `${jsonBase}/:modelKey/edit`,
        file: '#layers/autoadmin/pages/_jsonadmin/object-edit.vue',
      })
      pages.push({
        name: 'jsonadmin-array-create',
        path: `${jsonBase}/:modelKey/create`,
        file: '#layers/autoadmin/pages/_jsonadmin/array-create.vue',
      })
      pages.push({
        name: 'jsonadmin-array-update',
        path: `${jsonBase}/:modelKey/update/:lookupValue`,
        file: '#layers/autoadmin/pages/_jsonadmin/array-update.vue',
      })
      pages.push({
        name: 'jsonadmin-array-list',
        path: `${jsonBase}/:modelKey`,
        file: '#layers/autoadmin/pages/_jsonadmin/array-list.vue',
      })

      pages.push({
        name: 'autoadmin-index',
        path: adminPathPrefix,
        file: '#layers/autoadmin/pages/_autoadmin/index.vue',
      })
      pages.push({
        name: 'autoadmin-list',
        path: `${adminPathPrefix}/:modelKey`,
        file: '#layers/autoadmin/pages/_autoadmin/list.vue',
      })
      pages.push({
        name: 'autoadmin-create',
        path: `${adminPathPrefix}/:modelKey/create`,
        file: '#layers/autoadmin/pages/_autoadmin/create.vue',
      })
      pages.push({
        name: 'autoadmin-update',
        path: `${adminPathPrefix}/:modelKey/update/:lookupValue`,
        file: '#layers/autoadmin/pages/_autoadmin/update.vue',
      })
    },
  },
})
