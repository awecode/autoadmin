import type { JsonArrayResourceConfig } from '#layers/autoadmin/server/utils/jsonResourceRegistry'
import type { AutoadminRequestContext } from '#layers/autoadmin/server/utils/registry'

export type JsonBaseWhereAction = 'list' | 'detail' | 'update' | 'delete' | 'bulkDelete'

export interface JsonArrayBaseWhereContext {
  config: JsonArrayResourceConfig
  action: JsonBaseWhereAction
  event?: AutoadminRequestContext['event']
  query?: Record<string, unknown>
  lookupValue?: string | number
  lookupValues?: (string | number)[]
}

export type JsonArrayBaseWhereFn = (
  rows: Record<string, any>[],
  ctx: JsonArrayBaseWhereContext,
) => Record<string, any>[] | Promise<Record<string, any>[]>

export function buildJsonArrayBaseWhereContext(
  cfg: JsonArrayResourceConfig,
  action: JsonBaseWhereAction,
  requestCtx?: AutoadminRequestContext,
  extra?: Pick<JsonArrayBaseWhereContext, 'query' | 'lookupValue' | 'lookupValues'>,
): JsonArrayBaseWhereContext {
  return {
    config: cfg,
    action,
    event: requestCtx?.event,
    ...extra,
  }
}

export async function applyJsonArrayBaseWhere(
  rows: Record<string, any>[],
  cfg: JsonArrayResourceConfig,
  ctx: JsonArrayBaseWhereContext,
): Promise<Record<string, any>[]> {
  if (!cfg.baseWhere) {
    return rows
  }
  return await cfg.baseWhere(rows, ctx)
}

export async function assertJsonLookupsInBaseWhere(
  rows: Record<string, any>[],
  cfg: JsonArrayResourceConfig,
  ctx: JsonArrayBaseWhereContext,
  lookups: (string | number)[],
): Promise<void> {
  if (!cfg.baseWhere || lookups.length === 0) {
    return
  }
  const scoped = await applyJsonArrayBaseWhere(rows, cfg, {
    ...ctx,
    lookupValues: lookups,
  })
  const idField = cfg.idField
  const scopedIds = new Set(scoped.map(r => String(r[idField])))
  const unique = [...new Set(lookups.map(l => String(l)))]
  if (!unique.every(id => scopedIds.has(id))) {
    throw createError({
      statusCode: 404,
      statusMessage: `One or more records are not available for JSON resource "${cfg.key}".`,
    })
  }
}
