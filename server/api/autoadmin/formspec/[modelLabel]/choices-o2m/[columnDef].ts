import { getLabelColumnFromModel, getModelConfig } from '#layers/autoadmin/server/utils/autoadmin'

export default defineEventHandler(async (event) => {
  const modelKey = getRouterParam(event, 'modelKey')
  if (!modelKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model key is required.',
    })
  }
  const columnDef = getRouterParam(event, 'columnDef')
  if (!columnDef) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Column definition is required.',
    })
  }
  const cfg = getModelConfig(modelKey)
  if (!cfg.o2m) {
    throw createError({
      statusCode: 404,
      statusMessage: `No one-to-many relations provided for model ${modelKey} during registration.`,
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
