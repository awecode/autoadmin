import type { AdminModelConfig } from '#layers/autoadmin/server/utils/registry'
import type { Table } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { useAdminDb } from '../utils/db'
import { handleDrizzleError } from '../utils/drizzle'

export async function getRecordDetail<T extends Table>(cfg: AdminModelConfig<T>, lookupValue: string): Promise<any> {
  const db = useAdminDb()
  try {
    const result = await db
      .select()
      .from(cfg.model)
      .where(eq(cfg.lookupColumn, lookupValue))
      .limit(1)

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
