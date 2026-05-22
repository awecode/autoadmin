import { z } from 'zod'
import { getModelConfig } from '../../utils/autoadmin'
import { assertLookupsInBaseWhere, buildBaseWhereContext } from '../../utils/baseWhere'
import { useAdminDb } from '../../utils/db'
import { assertRoleAccessAllowed } from '../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    action: z.string(),
    modelKey: z.string(),
    rowLookups: z.union([z.array(z.string()), z.array(z.number())]),
    // rowLooups: z.array(z.union([z.string(), z.number()]))
  }).parse)
  const cfg = getModelConfig(body.modelKey)
  assertRoleAccessAllowed(event, { roles: cfg.roles }, 'update')
  const action = cfg.list.bulkActions.find(action => action.label === body.action)
  if (!action) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Action not found',
    })
  }
  const db = useAdminDb()
  await assertLookupsInBaseWhere(
    db,
    cfg,
    buildBaseWhereContext(cfg, 'bulkDelete', { event }, { lookupValues: body.rowLookups }),
    body.rowLookups,
  )
  const result = await action.action(db, body.rowLookups)
  return result
})
