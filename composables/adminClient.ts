import type { VNode } from 'vue'

interface AdminClientConfig {
  list?: {
    fields?: Array<{
      field: string | { name: string, }
      label?: string
      cell?: (cell: { row: Record<string, any> }) => VNode | string
    }>
  }
}

export function useAdminClient() {
  function getRegistry(): Map<string, AdminClientConfig> {
    // @ts-expect-error - globalThis is not typed
    if (!globalThis.autoadminClientRegistry) {
      // @ts-expect-error - globalThis is not typed
      globalThis.autoadminClientRegistry = new Map()
    }
    // @ts-expect-error - globalThis is not typed
    return globalThis.autoadminClientRegistry
  }

  const registry = getRegistry()

  const register = (modelKey: string, config: AdminClientConfig) => {
    registry.set(modelKey, config)
  }

  return {
    registry,
    register,
    get: (modelKey: string) => registry.get(modelKey),
  }
}
