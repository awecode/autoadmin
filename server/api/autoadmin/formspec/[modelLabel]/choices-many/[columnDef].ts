import { useAdminRegistry } from '~/composables/registry'
import { getLabelColumnFromModel } from '~/server/utils/autoadmin'
import { parseM2mRelations } from '~/server/utils/relation'

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
  if (!cfg.m2m) {
    throw createError({
      statusCode: 404,
      statusMessage: `No many-to-many relations provided for model ${modelLabel} during registration.`,
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
  const relation = relations.find(r => r.name === relationName && r.otherColumn.name === columnName)
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
    value: row[relation.otherForeignColumn.name],
  })))
  return choices
})
