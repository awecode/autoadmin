import type { AutoadminRoleKey, AutoadminRolesConfig } from './roleAccess'
import { ROLE_KEYS } from './roleAccess'

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
