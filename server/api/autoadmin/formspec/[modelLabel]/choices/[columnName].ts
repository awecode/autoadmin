import { useAdminRegistry } from '#layers/autoadmin/composables/useAdminRegistry'
import { getLabelColumnFromModel } from '#layers/autoadmin/utils/registry.js'
import { getTableForeignKeysByColumn } from '#layers/autoadmin/utils/relation'

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
  const relations = getTableForeignKeysByColumn(cfg.model, columnName)
  if (relations.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `No relations found for column ${columnName}.`,
    })
  }
  const db = useDb()
  const choices = []
  for (const relation of relations) {
    // TODO only select foreignColumn.name and labelField
    const rows = await db.select().from(relation.foreignTable)
    choices.push(...rows.map(row => ({
      label: row[getLabelColumnFromModel(relation.foreignTable)],
      value: row[relation.foreignColumn.name],
    })))
  }
  return choices
})
