import type { AdminModelConfig, AutoadminRequestContext } from '#layers/autoadmin/server/utils/registry'
import type { Table } from 'drizzle-orm'
import type { AuditAction, AuditChanges } from './audit'
import {
  auditRecordsEqual,
  emitAuditEvent,
  getAuditConfig,
  isModelAuditEnabled,
  resolveModelAuditOptions,
  sanitizeAuditRecord,
} from './audit'

export async function maybeEmitModelAudit<T extends Table>(options: {
  cfg: AdminModelConfig<T>
  action: AuditAction
  requestCtx?: AutoadminRequestContext
  lookupValue?: string | number
  changes?: AuditChanges
  meta?: Record<string, unknown>
  beforeRecord?: Record<string, unknown> | null
  afterRecord?: Record<string, unknown> | null
}): Promise<void> {
  if (!isModelAuditEnabled(options.cfg.audit)) {
    return
  }
  const globalConfig = getAuditConfig()
  if (!globalConfig.write && !globalConfig.table) {
    console.warn(
      `[autoadmin] Model "${options.cfg.key}" has audit enabled, but configureAudit was not called (or has no table/write). Skipping audit entry.`,
    )
    return
  }

  const modelOpts = resolveModelAuditOptions(options.cfg.audit)
  const sanitizeOpts = {
    excludeFields: modelOpts?.excludeFields,
    includeFields: modelOpts?.includeFields,
    globalExcludeFields: globalConfig.excludeFields,
  }

  const changes: AuditChanges | undefined = options.changes ?? {
    before: sanitizeAuditRecord(options.beforeRecord ?? undefined, sanitizeOpts),
    after: sanitizeAuditRecord(options.afterRecord ?? undefined, sanitizeOpts),
  }

  // No-op update (open form and save without edits): skip the audit row.
  if (
    options.action === 'update'
    && changes.before
    && changes.after
    && auditRecordsEqual(changes.before, changes.after)
  ) {
    return
  }

  const hasChanges = changes.before || changes.after
  await emitAuditEvent({
    action: options.action,
    modelKey: options.cfg.key,
    lookupValue: options.lookupValue,
    event: options.requestCtx?.event,
    changes: hasChanges ? changes : undefined,
    meta: options.meta,
  })
}
