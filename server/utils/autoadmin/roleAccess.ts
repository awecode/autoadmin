import type { H3Event } from 'h3'
import { createError } from 'h3'

const ROLE_KEYS = ['full', 'list', 'view', 'create', 'update', 'delete'] as const

export type AutoadminRoleKey = (typeof ROLE_KEYS)[number]

/** Normalized role allowlists per action / `full` (shorthand array becomes `{ full }`). */
export type AutoadminRolesConfig = Partial<Record<AutoadminRoleKey, string[]>>

export type AutoadminAccess = 'list' | 'detail' | 'create' | 'update' | 'delete'

export interface AutoadminRolePolicy {
  roles?: AutoadminRolesConfig
}

function trimRoleArray(arr: string[]): string[] {
  const out = [...new Set(arr.map(s => String(s).trim()).filter(Boolean))]
  return out
}

function hasAnyRoleEntry(roles: AutoadminRolesConfig): boolean {
  return ROLE_KEYS.some((k) => {
    const v = roles[k]
    return Array.isArray(v) && v.length > 0
  })
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

export function getUserRoleFromEvent(event: H3Event): string | undefined {
  const auth = event.context.auth as { user?: { role?: string } } | undefined
  const r = auth?.user?.role
  if (r == null) {
    return undefined
  }
  const s = String(r).trim()
  return s || undefined
}

function userMatchesList(userRole: string | undefined, allowed: string[] | undefined): boolean {
  if (!userRole || !allowed?.length) {
    return false
  }
  return allowed.includes(userRole)
}

/**
 * Enforces `policy.roles` when present. Missing/denied → 403.
 * Order: `full` short-circuit; then per `access`; fail closed if policy exists but access not allowed.
 */
export function assertRoleAccessAllowed(
  event: H3Event,
  policy: AutoadminRolePolicy,
  access: AutoadminAccess,
): void {
  const roles = policy.roles
  if (!roles || !hasAnyRoleEntry(roles)) {
    return
  }

  const userRole = getUserRoleFromEvent(event)

  if (userMatchesList(userRole, roles.full)) {
    return
  }

  let allowed = false
  switch (access) {
    case 'list':
      allowed = userMatchesList(userRole, roles.list) || userMatchesList(userRole, roles.view)
      break
    case 'detail':
      allowed = userMatchesList(userRole, roles.view)
      break
    case 'create':
      allowed = userMatchesList(userRole, roles.create)
      break
    case 'update':
      allowed = userMatchesList(userRole, roles.update)
      break
    case 'delete':
      allowed = userMatchesList(userRole, roles.delete)
      break
  }

  if (allowed) {
    return
  }

  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
  })
}
