import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { getRowLabel, parseRelations } from '#layers/autoadmin/utils/relation'

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
  if (!cfg.relations) {
    throw createError({
      statusCode: 404,
      statusMessage: `No relations found for model ${modelLabel}.`,
    })
  }
  const relations = parseRelations(cfg.model, cfg.relations)
  // columnDef is in the format of ___relationName___columnName
  const [_, relationName, columnName] = columnDef.split('___')
  if (!relationName || !columnName) {
    throw createError({
      statusCode: 404,
      statusMessage: `Invalid column definition ${columnDef}.`,
    })
  }
  const relation = relations.m2m.find(r => r.name === relationName && r.otherColumnName === columnName)
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
    label: getRowLabel(row),
    value: row[relation.otherForeignColumnName],
  })))
  return choices
})
