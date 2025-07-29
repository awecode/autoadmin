import { getLabelColumnFromModel, getModelConfig } from '#layers/autoadmin/server/utils/autoadmin'
import { colKey } from '#layers/autoadmin/server/utils/drizzle'
import { getTableForeignKeysByColumn } from '#layers/autoadmin/server/utils/relation'

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
  const cfg = getModelConfig(modelLabel)
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
    // TODO only select colKey(foreignColumn) and labelField
    const rows = await db.select().from(relation.foreignTable)
    choices.push(...rows.map(row => ({
      label: row[getLabelColumnFromModel(relation.foreignTable)],
      value: row[colKey(relation.foreignColumn)],
    })))
  }
  return choices
})
