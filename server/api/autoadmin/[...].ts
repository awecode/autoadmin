import { createRecord } from '../../services/create'
import { deleteRecord } from '../../services/delete'
import { getRecordDetail } from '../../services/detail'
import { listRecords } from '../../services/list'
import { updateRecord } from '../../services/update'
import { isOwnedAuditTable, withOwnedAuditTableRetry } from '../../utils/audit'
import { getAuditFieldMeta } from '../../utils/auditFieldMeta'
import { getModelConfig } from '../../utils/autoadmin'
import { buildBaseWhereContext, whereWithBaseWhere } from '../../utils/baseWhere'
import { useAdminDb } from '../../utils/db'
import { useAdminRegistry } from '../../utils/registry'
import { assertRoleAccessAllowed, getAllowedActions } from '../../utils/roleHelpers'
import { parseAutoadminRoute } from '../../utils/router'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const method = event.method

  // URL Structure:
  // <apiPrefix>/<autoadmin-route>

  // Autoadmin Route Structure:
  // GET <model-label>: List
  // POST <model-label> <body>: Create
  // GET <model-label>/<lookup-field-value>: Detail
  // POST/PATCH/PUT <model-label>/<lookup-field-value> <body>: Update
  // DELETE <model-label>/<lookup-field-value>: Delete

  const config = useRuntimeConfig()
  const apiPrefix = config.public.autoadmin.apiPrefix
  const pathSegments = url.pathname.split(apiPrefix)[1] || ''

  const parsedRoute = parseAutoadminRoute(pathSegments, method)

  const query = getQuery(event)
  const body = method !== 'GET' ? await readBody(event) : undefined

  const cfg = getModelConfig(parsedRoute.modelKey)
  assertRoleAccessAllowed(event, { roles: cfg.roles }, parsedRoute.routeType)

  switch (parsedRoute.routeType) {
    case 'list': {
      const run = () => listRecords(cfg, query, true, getAllowedActions(event, { roles: cfg.roles }), { event })
      if (isOwnedAuditTable(cfg.model)) {
        return await withOwnedAuditTableRetry(cfg.model, run)
      }
      return await run()
    }

    case 'create':
      if (!body) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Request body is required for create operation',
        })
      }
      return await createRecord(cfg, body, { event })

    case 'detail': {
      if (!parsedRoute.lookupValue) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Lookup value is required for detail operation',
        })
      }
      const run = async () => {
        const row = await getRecordDetail(cfg, parsedRoute.lookupValue!, { event })
        if (isOwnedAuditTable(cfg.model) && row && typeof row === 'object' && 'modelKey' in row && row.modelKey) {
          const auditedModelKey = String(row.modelKey)
          const auditedLookup = row.lookupValue
          let objectPath: { name: string, params: { modelKey: string, lookupValue: string } } | undefined
          let viewOnSiteUrl: string | undefined
          if (auditedLookup != null && auditedLookup !== '') {
            const auditedCfg = useAdminRegistry().get(auditedModelKey)
            if (auditedCfg) {
              const allowed = getAllowedActions(event, { roles: auditedCfg.roles })
              if (auditedCfg.update.enabled && allowed.update) {
                objectPath = {
                  name: 'autoadmin-update',
                  params: {
                    modelKey: auditedModelKey,
                    lookupValue: String(auditedLookup),
                  },
                }
              }
              if (auditedCfg.getAbsoluteUrl && (allowed.detail || allowed.list || allowed.update)) {
                try {
                  const db = await useAdminDb()
                  const ctx = buildBaseWhereContext(auditedCfg, 'detail', { event }, {
                    lookupValue: String(auditedLookup),
                  })
                  const where = await whereWithBaseWhere(
                    auditedCfg,
                    ctx,
                    eq(auditedCfg.lookupColumn, String(auditedLookup)),
                  )
                  let query = db.select().from(auditedCfg.model)
                  if (where) {
                    query = query.where(where) as unknown as typeof query
                  }
                  const records = await query.limit(1)
                  const record = records[0]
                  if (record) {
                    const url = auditedCfg.getAbsoluteUrl(record)
                    if (url) {
                      viewOnSiteUrl = url
                    }
                  }
                }
                catch {
                  // Record may be deleted or out of scope; omit the button.
                }
              }
            }
          }
          return {
            ...row,
            fieldMeta: getAuditFieldMeta(auditedModelKey),
            objectPath,
            viewOnSiteUrl,
          }
        }
        return row
      }
      if (isOwnedAuditTable(cfg.model)) {
        return await withOwnedAuditTableRetry(cfg.model, run)
      }
      return await run()
    }

    case 'update':
      if (!parsedRoute.lookupValue) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Lookup value is required for update operation',
        })
      }
      if (!body) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Request body is required for update operation',
        })
      }
      return await updateRecord(cfg, parsedRoute.lookupValue, body, { event })

    case 'delete':
      if (!parsedRoute.lookupValue) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Lookup value is required for delete operation',
        })
      }
      return await deleteRecord(cfg, parsedRoute.lookupValue, { event })

    default:
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid route type',
      })
  }
})
