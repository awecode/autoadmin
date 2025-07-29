import type { AdminModelConfig } from '#layers/autoadmin/composables/registry'

// TODO: Implement actual database calls
export async function getRecordDetail(cfg: AdminModelConfig, lookupValue: string): Promise<any> {
  const modelKey = cfg.key
  return {
    id: lookupValue,
    name: `Sample ${modelKey}`,
    created_at: new Date().toISOString(),
  }
}
