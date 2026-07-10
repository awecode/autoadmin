import type { AdminModelConfig, AutoadminRequestContext } from '#layers/autoadmin/server/utils/registry'
import type { SQL, Table } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { AdminDbType } from './db'
import { and, inArray } from 'drizzle-orm'
import { useAdminDb } from './db'

export type BaseWhereAction = 'list' | 'detail' | 'update' | 'delete' | 'bulkDelete' | 'reorder'

export interface BaseWhereContext<T extends Table = Table> {
  config: AdminModelConfig<T>
  action: BaseWhereAction
  event?: H3Event
  query?: Record<string, unknown>
  lookupValue?: string | number
  lookupValues?: (string | number)[]
}

export type BaseWhereFn<T extends Table = Table> = (
  db: AdminDbType,
  ctx: BaseWhereContext<T>,
) => Promise<SQL | SQL[] | undefined> | SQL | SQL[] | undefined

export function buildBaseWhereContext<T extends Table>(
  cfg: AdminModelConfig<T>,
  action: BaseWhereAction,
  requestCtx?: AutoadminRequestContext,
  extra?: Pick<BaseWhereContext<T>, 'query' | 'lookupValue' | 'lookupValues'>,
): BaseWhereContext<T> {
  return {
    config: cfg,
    action,
    event: requestCtx?.event,
    ...extra,
  }
}

function normalizeBaseWhereResult(result: SQL | SQL[] | undefined): SQL[] {
  if (result === undefined) {
    return []
  }
  return Array.isArray(result) ? result : [result]
}

export async function getBaseWhereConditions<T extends Table>(
  cfg: AdminModelConfig<T>,
  ctx: BaseWhereContext<T>,
): Promise<SQL[]> {
  if (!cfg.baseWhere) {
    return []
  }
  const db = await useAdminDb()
  return normalizeBaseWhereResult(await cfg.baseWhere(db, ctx))
}

export function mergeWhere(...parts: (SQL | undefined)[]): SQL | undefined {
  const defined = parts.filter((p): p is SQL => p !== undefined)
  if (defined.length === 0) {
    return undefined
  }
  if (defined.length === 1) {
    return defined[0]
  }
  return and(...defined)
}

export async function getBaseWhereClause<T extends Table>(
  cfg: AdminModelConfig<T>,
  ctx: BaseWhereContext<T>,
): Promise<SQL | undefined> {
  return mergeWhere(...await getBaseWhereConditions(cfg, ctx))
}

export async function whereWithBaseWhere<T extends Table>(
  cfg: AdminModelConfig<T>,
  ctx: BaseWhereContext<T>,
  ...parts: (SQL | undefined)[]
): Promise<SQL | undefined> {
  const base = await getBaseWhereClause(cfg, ctx)
  return mergeWhere(...parts, base)
}

export async function assertLookupsInBaseWhere<T extends Table>(
  db: AdminDbType,
  cfg: AdminModelConfig<T>,
  ctx: BaseWhereContext<T>,
  lookups: (string | number)[],
): Promise<void> {
  if (!cfg.baseWhere || lookups.length === 0) {
    return
  }
  const where = await whereWithBaseWhere(
    cfg,
    { ...ctx, lookupValues: lookups },
    inArray(cfg.lookupColumn, lookups),
  )
  if (!where) {
    return
  }
  const found = await db
    .select({ lookup: cfg.lookupColumn })
    .from(cfg.model)
    .where(where)
  if (found.length !== lookups.length) {
    throw createError({
      statusCode: 404,
      statusMessage: `One or more records are not available for model "${cfg.key}".`,
    })
  }
}
