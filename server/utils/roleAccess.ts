import type { H3Event } from 'h3'

export const ROLE_KEYS = ['full', 'list', 'view', 'create', 'update', 'delete'] as const
export type AutoadminRoleKey = (typeof ROLE_KEYS)[number]
export type AutoadminRolesConfig = Partial<Record<AutoadminRoleKey, string[]>>
export type AutoadminAction = 'list' | 'detail' | 'create' | 'update' | 'delete'

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
 * Resolve the current user's role string.
 */
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
 * Decide whether a resolved `userRole` may perform `action` under `roles`.
 * Order: no policy → allow; `full` short-circuit; then per `action`;
 */
export function isAccessAllowed(
  userRole: string | undefined,
  roles: AutoadminRolesConfig | undefined,
  action: AutoadminAction,
): boolean {
  if (!roles || !hasAnyRoleEntry(roles)) {
    return true
  }
  if (userMatchesList(userRole, roles.full)) {
    return true
  }
  switch (action) {
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
