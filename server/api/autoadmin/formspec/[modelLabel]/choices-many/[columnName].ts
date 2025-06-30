import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { getRowLabel, getTableRelationsByColumn, parseRelations } from '#layers/autoadmin/utils/relation'

export default defineEventHandler(async (event) => {
  const modelLabel = getRouterParam(event, 'modelLabel')
  if (!modelLabel) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model label is required.',
    })
  }
  const columnName = getRouterParam(event, 'columnName')
  if (!columnName) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Column name is required.',
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
  const relation = relations.find(r => r.columnName === columnName)
  if (!relation) {
    throw createError({
      statusCode: 404,
      statusMessage: `No relation found for column ${columnName}.`,
    })
  }
  const db = useDb()
  const choices = []
  const rows = await db.select().from(relation.foreignTable)
  choices.push(...rows.map(row => ({
    label: getRowLabel(row),
    value: row[relation.foreignColumnName],
  })))
  return choices
})
