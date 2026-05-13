import { buildJsonRegistryMeta } from '../../../utils/registryMeta'

export default defineEventHandler(async (event) => {
  return buildJsonRegistryMeta(event)
})
