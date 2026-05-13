import type { AutoadminAction, AutoadminRoleKey, AutoadminRolesConfig } from '#autoadmin/roleAccess'
import type { H3Event } from 'h3'
import { getUserRoleFromEvent, isAccessAllowed, ROLE_KEYS } from '#autoadmin/roleAccess'
import { createError } from 'h3'

export interface AutoadminRolePolicy {
  roles?: AutoadminRolesConfig
}

/** Map of `AutoadminAction` → whether the current user may perform that action. */
export type AutoadminAllowedActions = Record<AutoadminAction, boolean>

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

/** Enforces `policy.roles` when present. Missing/denied → 403. */
export function assertRoleAccessAllowed(
  event: H3Event,
  policy: AutoadminRolePolicy,
  action: AutoadminAction,
): void {
  if (isAccessAllowed(getUserRoleFromEvent(event), policy.roles, action)) {
    return
  }
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
  })
}

/** Enforces that at least one of the supplied actions is allowed. */
export function assertAnyRoleAccessAllowed(
  event: H3Event,
  policy: AutoadminRolePolicy,
  actions: AutoadminAction[],
): void {
  const userRole = getUserRoleFromEvent(event)
  if (actions.some(action => isAccessAllowed(userRole, policy.roles, action))) {
    return
  }
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
  })
}

function trimRoleArray(arr: string[]): string[] {
  const out = [...new Set(arr.map(s => String(s).trim()).filter(Boolean))]
  return out
}

/**
 * Registration input: `string[]` means `{ full: [...] }`; object keys validated.
 * Returns `undefined` when nothing to enforce.
 */
export function normalizeAutoadminRolesInput(
  input: string[] | AutoadminRolesConfig | undefined,
): AutoadminRolesConfig | undefined {
  if (input === undefined) {
    return undefined
  }
  if (Array.isArray(input)) {
    const full = trimRoleArray(input as string[])
    if (full.length === 0) {
      return undefined
    }
    return { full }
  }
  const out: AutoadminRolesConfig = {}
  for (const key of Object.keys(input)) {
    if (!ROLE_KEYS.includes(key as AutoadminRoleKey)) {
      throw new TypeError(
        `Invalid roles key "${key}". Allowed: ${ROLE_KEYS.join(', ')}.`,
      )
    }
    const rk = key as AutoadminRoleKey
    const raw = (input as AutoadminRolesConfig)[rk]
    if (raw === undefined) {
      continue
    }
    if (!Array.isArray(raw)) {
      throw new TypeError(`roles.${rk} must be a string[].`)
    }
    const trimmed = trimRoleArray(raw as string[])
    if (trimmed.length > 0) {
      out[rk] = trimmed
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Runtime allowlists (e.g. `fileUploadRoles`): trim, unique, drop empty.
 * `undefined`, missing, or all-empty after trim → **no restriction** (caller treats as allow all).
 */
export function normalizeRuntimeRoleAllowlist(
  input: string[] | undefined,
): string[] | undefined {
  if (input === undefined || input.length === 0) {
    return undefined
  }
  const out = trimRoleArray(input)
  return out.length > 0 ? out : undefined
}
