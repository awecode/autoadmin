import { buildJsonArrayCreateFormSpec } from '../../../../../utils/jsonFormSpec'
import { useJsonResourceRegistry } from '../../../../../utils/jsonResourceRegistry'
import { assertRoleAccessAllowed, getAllowedActions } from '../../../../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const modelKey = getRouterParam(event, 'modelKey')
  if (!modelKey) {
    throw createError({ statusCode: 404, statusMessage: 'Resource key is required.' })
  }
  const reg = useJsonResourceRegistry()
  const cfg = reg.get(modelKey)
  if (!cfg || cfg.kind !== 'array') {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found or not an array.' })
  }
  assertRoleAccessAllowed(event, { roles: cfg.roles }, 'create')
  if (!cfg.create.enabled) {
    throw createError({ statusCode: 404, statusMessage: 'Create is disabled for this resource.' })
  }
  const spec = await buildJsonArrayCreateFormSpec(cfg, modelKey)
  spec.canList = getAllowedActions(event, { roles: cfg.roles }).list
  return { spec }
})
