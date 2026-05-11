import type { H3Event } from 'h3'
import { createError } from 'h3'

export const ROLE_KEYS = ['full', 'list', 'view', 'create', 'update', 'delete'] as const

export type AutoadminRoleKey = (typeof ROLE_KEYS)[number]

export type AutoadminRolesConfig = Partial<Record<AutoadminRoleKey, string[]>>

export type AutoadminAccess = 'list' | 'detail' | 'create' | 'update' | 'delete'

export interface AutoadminRolePolicy {
  roles?: AutoadminRolesConfig
}

/** Map of `AutoadminAccess` → whether the current user may perform that action. */
export type AutoadminAllowedActions = Record<AutoadminAccess, boolean>

function hasAnyRoleEntry(roles: AutoadminRolesConfig): boolean {
  return ROLE_KEYS.some((k) => {
    const v = roles[k]
    return Array.isArray(v) && v.length > 0
  })
}

function userMatchesList(userRole: string | undefined, allowed: string[] | undefined): boolean {
  if (!userRole || !allowed?.length) {
    return false
  }
  return allowed.includes(userRole)
}

/**
 * No policy → allow; `full` short-circuit; then per `access`; fail-closed when
 * a policy exists but `access` is not permitted.
 */
function isAccessAllowed(
  userRole: string | undefined,
  roles: AutoadminRolesConfig | undefined,
  access: AutoadminAccess,
): boolean {
  if (!roles || !hasAnyRoleEntry(roles)) {
    return true
  }
  if (userMatchesList(userRole, roles.full)) {
    return true
  }
  switch (access) {
    case 'list':
      return userMatchesList(userRole, roles.list) || userMatchesList(userRole, roles.view)
    case 'detail':
      return userMatchesList(userRole, roles.view)
    case 'create':
      return userMatchesList(userRole, roles.create)
    case 'update':
      return userMatchesList(userRole, roles.update)
    case 'delete':
      return userMatchesList(userRole, roles.delete)
  }
}

export function getUserRoleFromEvent(event: H3Event): string | undefined {
  const auth = event.context.auth as { user?: { role?: string } } | undefined
  const r = auth?.user?.role
  if (r == null) {
    return undefined
  }
  const s = String(r).trim()
  return s || undefined
}

/**
 * Resolve which actions the current user may perform on a resource. Use to
 * shape responses (e.g. hide row action icons) without raising 403s. Servers
 * still call `assertRoleAccessAllowed` independently to enforce access.
 */
export function getAllowedActions(
  event: H3Event,
  policy: AutoadminRolePolicy,
): AutoadminAllowedActions {
  const userRole = getUserRoleFromEvent(event)
  const roles = policy.roles
  return {
    list: isAccessAllowed(userRole, roles, 'list'),
    detail: isAccessAllowed(userRole, roles, 'detail'),
    create: isAccessAllowed(userRole, roles, 'create'),
    update: isAccessAllowed(userRole, roles, 'update'),
    delete: isAccessAllowed(userRole, roles, 'delete'),
  }
}

/**
 * Enforces `policy.roles` when present. Missing/denied → 403.
 */
export function assertRoleAccessAllowed(
  event: H3Event,
  policy: AutoadminRolePolicy,
  access: AutoadminAccess,
): void {
  if (isAccessAllowed(getUserRoleFromEvent(event), policy.roles, access)) {
    return
  }
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
  })
}
