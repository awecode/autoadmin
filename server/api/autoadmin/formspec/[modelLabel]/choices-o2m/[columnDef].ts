import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { getLabelColumnFromModel } from '#layers/autoadmin/utils/registry'

export default defineEventHandler(async (event) => {
  const modelLabel = getRouterParam(event, 'modelLabel')
  if (!modelLabel) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model label is required.',
    })
  }
  const columnDef = getRouterParam(event, 'columnDef')
  if (!columnDef) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Column definition is required.',
    })
  }
  const cfg = useAdminRegistry().get(modelLabel)
  if (!cfg) {
    throw createError({
      statusCode: 404,
      statusMessage: `Model ${modelLabel} not registered.`,
    })
  }
  if (!cfg.o2m) {
    throw createError({
      statusCode: 404,
      statusMessage: `No one-to-many relations provided for model ${modelLabel} during registration.`,
    })
  }
  // columnDef is in the format of ___relationName___columnName
  const [_, relationName, columnName] = columnDef.split('___')
  if (!relationName || !columnName) {
    throw createError({
      statusCode: 404,
      statusMessage: `Invalid column definition ${columnDef}.`,
    })
  }
  const relation = cfg.o2m[relationName]
  if (!relation) {
    throw createError({
      statusCode: 404,
      statusMessage: `No relation found for column ${columnDef}.`,
    })
  }
  const db = useDb()
  const choices = []
  const rows = await db.select().from(relation)
  choices.push(...rows.map(row => ({
    label: row[getLabelColumnFromModel(relation)],
    value: row[columnName],
  })))
  return choices
})
