import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { getTableRelationsByColumn } from '#layers/autoadmin/utils/relation'

function getRowLabel(row: Record<string, any>) {
  return row.name ?? row.title ?? row.label ?? Object.values(row)[0]
}

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
  const relations = getTableRelationsByColumn(cfg.model, columnName)
  const db = useDb()
  const choices = []
  for (const relation of relations) {
    // TODO only select foreignColumnName and labelField
    const rows = await db.select().from(relation.foreignTable)
    choices.push(...rows.map(row => ({
      label: getRowLabel(row),
      value: row[relation.foreignColumnName],
    })))
  }
  return choices
})
