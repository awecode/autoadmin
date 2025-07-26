import type { AdminModelConfig } from '#layers/autoadmin/composables/registry'

// TODO: Implement actual database calls
export async function getRecordDetail(cfg: AdminModelConfig, lookupValue: string): Promise<any> {
  const modelLabel = cfg.label
  return {
    id: lookupValue,
    name: `Sample ${modelLabel}`,
    created_at: new Date().toISOString(),
  }
}
