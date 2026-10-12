import type { CustomFilter } from '#layers/autoadmin/server/utils/filter'
import { getModelConfig } from '#layers/autoadmin/server/utils/autoadmin'
import { assertAnyRoleAccessAllowed } from '#layers/autoadmin/server/utils/roleHelpers'

/** Choices for a custom list filter that sets `lazyOptions: true`. Called when the filter dropdown opens. */
export default defineEventHandler(async (event) => {
  const modelKey = getRouterParam(event, 'modelKey')
  if (!modelKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model key is required.',
    })
  }
  const parameterName = getRouterParam(event, 'parameterName')
  if (!parameterName) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Filter name is required.',
    })
  }
  const cfg = getModelConfig(modelKey)
  assertAnyRoleAccessAllowed(event, { roles: cfg.roles }, ['list'])

  const filter = (cfg.list.filterFields ?? []).find((item): item is CustomFilter => {
    return typeof item === 'object' && 'parameterName' in item && item.parameterName === parameterName
  })
  if (!filter?.lazyOptions || !filter.options) {
    throw createError({
      statusCode: 404,
      statusMessage: `No lazy filter named ${parameterName} on ${modelKey}.`,
    })
  }

  const db = await useAdminDb()
  return await filter.options(db, getQuery(event))
})
