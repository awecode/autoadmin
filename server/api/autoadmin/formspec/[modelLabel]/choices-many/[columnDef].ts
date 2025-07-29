import { getLabelColumnFromModel, getModelConfig } from '#layers/autoadmin/server/utils/autoadmin'
import { colKey } from '#layers/autoadmin/server/utils/drizzle'
import { parseM2mRelations } from '#layers/autoadmin/server/utils/relation'

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
  if (!cfg.m2m) {
    throw createError({
      statusCode: 404,
      statusMessage: `No many-to-many relations provided for model ${modelKey} during registration.`,
    })
  }
  const relations = parseM2mRelations(cfg.model, cfg.m2m)
  // columnDef is in the format of ___relationName___columnName
  const [_, relationName, columnName] = columnDef.split('___')
  if (!relationName || !columnName) {
    throw createError({
      statusCode: 404,
      statusMessage: `Invalid column definition ${columnDef}.`,
    })
  }
  const relation = relations.find(r => r.name === relationName && colKey(r.otherColumn) === columnName)
  if (!relation) {
    throw createError({
      statusCode: 404,
      statusMessage: `No relation found for column ${columnDef}.`,
    })
  }
  const db = useDb()
  const choices = []
  const rows = await db.select().from(relation.otherTable)
  choices.push(...rows.map(row => ({
    label: row[getLabelColumnFromModel(relation.otherTable)],
    value: row[colKey(relation.otherForeignColumn)],
  })))
  return choices
})
