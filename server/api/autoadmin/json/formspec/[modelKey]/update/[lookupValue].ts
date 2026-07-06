import { buildJsonArrayUpdateFormSpec, buildJsonObjectUpdateFormSpec } from '../../../../../../utils/jsonFormSpec'
import { JSON_OBJECT_LOOKUP, useJsonResourceRegistry } from '../../../../../../utils/jsonResourceRegistry'
import { assertRoleAccessAllowed, getAllowedActions } from '../../../../../../utils/roleHelpers'

export default defineEventHandler(async (event) => {
  const modelKey = getRouterParam(event, 'modelKey')
  const lookupValue = getRouterParam(event, 'lookupValue')
  if (!modelKey || lookupValue === undefined) {
    throw createError({ statusCode: 404, statusMessage: 'Resource key and lookup are required.' })
  }
  const reg = useJsonResourceRegistry()
  const cfg = reg.get(modelKey)
  if (!cfg) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found.' })
  }
  assertRoleAccessAllowed(event, { roles: cfg.roles }, 'update')
  if (cfg.kind === 'array') {
    if (!cfg.update.enabled) {
      throw createError({ statusCode: 404, statusMessage: 'Update is disabled for this resource.' })
    }
    const spec = await buildJsonArrayUpdateFormSpec(cfg, modelKey, lookupValue, { event })
    spec.canList = getAllowedActions(event, { roles: cfg.roles }).list
    return { spec }
  }
  if (lookupValue !== JSON_OBJECT_LOOKUP) {
    throw createError({
      statusCode: 404,
      statusMessage: `Object resources use lookup "${JSON_OBJECT_LOOKUP}" in the formspec URL.`,
    })
  }
  if (!cfg.update.enabled) {
    throw createError({ statusCode: 404, statusMessage: 'Update is disabled for this resource.' })
  }
  const spec = await buildJsonObjectUpdateFormSpec(cfg, modelKey)
  return { spec }
})
