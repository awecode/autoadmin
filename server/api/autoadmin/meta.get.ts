import type { AutoAdminMetaResponse } from '#layers/autoadmin/utils/registryMeta'
import { buildDrizzleRegistryMeta, buildJsonRegistryMeta } from '../../utils/registryMeta'

export default defineEventHandler(async (event): Promise<AutoAdminMetaResponse> => ({
  drizzle: buildDrizzleRegistryMeta(event),
  json: buildJsonRegistryMeta(event),
}))
