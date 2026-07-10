import type { AdminModelConfig, AutoadminRequestContext } from '#layers/autoadmin/server/utils/registry'
import type { Table } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { buildBaseWhereContext, whereWithBaseWhere } from '../utils/baseWhere'
import { useAdminDb } from '../utils/db'
import { handleDrizzleError } from '../utils/drizzle'

export async function getRecordDetail<T extends Table>(
  cfg: AdminModelConfig<T>,
  lookupValue: string,
  requestCtx?: AutoadminRequestContext,
): Promise<any> {
  const db = await useAdminDb()
  const ctx = buildBaseWhereContext(cfg, 'detail', requestCtx, { lookupValue })
  try {
    const where = await whereWithBaseWhere(cfg, ctx, eq(cfg.lookupColumn, lookupValue))
    let query = db.select().from(cfg.model)
    if (where) {
      query = query.where(where) as unknown as typeof query
    }
    const result = await query.limit(1)

    if (!result.length) {
      throw createError({
        statusCode: 404,
        statusMessage: `No instance found for model "${cfg.key}" with lookup value "${lookupValue}".`,
      })
    }

    return result[0]
  }
  catch (error) {
    if ((error as any)?.statusCode) {
      throw error
    }
    throw createError(handleDrizzleError(error))
  }
}
