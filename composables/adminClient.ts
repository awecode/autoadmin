import type { VNode } from 'vue'

import type { EmbedType } from '../components/editor/Embed'

export interface RichTextConfig {
  placeholder?: string
  disabledHeadingLevels?: number[]
  allowedMimeTypes?: string[]
  textAlignTypes?: string[]
  baseClass?: string
  toolbarClass?: string
  extraFixedToolbarItems?: any[][]
  extraBubbleToolbarItems?: any[][]
  extensions?: any[]
  embedTypes?: EmbedType[]
}

interface AdminClientConfig {
  list?: {
    fields?: Array<{
      field: string | { name: string }
      label?: string
      cell?: (cell: { row: Record<string, any> }) => VNode | string
    }>
  }
  richText?: Record<string, RichTextConfig>
}

function getGlobalStore() {
  // @ts-expect-error - globalThis is not typed
  if (!globalThis.__autoadminClient) {
    // @ts-expect-error - globalThis is not typed
    globalThis.__autoadminClient = {
      registry: new Map<string, AdminClientConfig>(),
      globalRichText: undefined as RichTextConfig | undefined,
    }
  }
  // @ts-expect-error - globalThis is not typed
  return globalThis.__autoadminClient as {
    registry: Map<string, AdminClientConfig>
    globalRichText: RichTextConfig | undefined
  }
}

export function useAdminClient() {
  const store = getGlobalStore()
  const registry = store.registry

  const register = (modelKey: string, config: AdminClientConfig) => {
    const existing = registry.get(modelKey)
    if (existing) {
      registry.set(modelKey, { ...existing, ...config })
    }
    else {
      registry.set(modelKey, config)
    }
  }

  function setGlobalRichText(config: RichTextConfig) {
    store.globalRichText = config
  }

  function getRichTextConfig(modelKey: string, fieldName: string): RichTextConfig | undefined {
    const globalCfg = store.globalRichText
    const fieldCfg = registry.get(modelKey)?.richText?.[fieldName]

    if (!globalCfg && !fieldCfg)
      return undefined
    if (!globalCfg)
      return fieldCfg
    if (!fieldCfg)
      return globalCfg

    return {
      ...globalCfg,
      ...fieldCfg,
      extraFixedToolbarItems: [...(globalCfg.extraFixedToolbarItems ?? []), ...(fieldCfg.extraFixedToolbarItems ?? [])],
      extraBubbleToolbarItems: [...(globalCfg.extraBubbleToolbarItems ?? []), ...(fieldCfg.extraBubbleToolbarItems ?? [])],
      extensions: [...(globalCfg.extensions ?? []), ...(fieldCfg.extensions ?? [])],
    }
  }

  return {
    registry,
    register,
    get: (modelKey: string) => registry.get(modelKey),
    setGlobalRichText,
    getRichTextConfig,
  }
}
