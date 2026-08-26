import { toTitleCase } from '#layers/autoadmin/utils/string'

/** Format a single audit payload value for display. */
export function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '—'
  }
  if (typeof value === 'string') {
    return value || '—'
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

export interface AuditChangesPayload {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export interface AuditLogEntry {
  id?: number | string
  action: string
  modelKey: string
  lookupValue?: string | null
  actorId?: string | null
  actorRole?: string | null
  actorLabel?: string | null
  createdAt?: string | Date | number | null
  changes?: AuditChangesPayload | null
  meta?: Record<string, unknown> | null
}

export interface AuditDiffSegment {
  type: 'equal' | 'add' | 'remove'
  text: string
}

export function isAuditLogEntry(row: Record<string, unknown> | null | undefined): row is AuditLogEntry & Record<string, unknown> {
  if (!row || typeof row !== 'object') {
    return false
  }
  return typeof row.action === 'string' && typeof row.modelKey === 'string'
}

/** Union of keys from before/after for field-level diff tables. */
export function auditChangeFieldKeys(changes: AuditChangesPayload | null | undefined): string[] {
  if (!changes) {
    return []
  }
  const keys = new Set([
    ...Object.keys(changes.before ?? {}),
    ...Object.keys(changes.after ?? {}),
  ])
  return Array.from(keys).sort()
}

/** Prefer the registered admin label when present in drizzle meta links. */
export function labelForModelKey(
  modelKey: string,
  drizzleLinks?: Array<{ label: string, to: { params?: { modelKey?: string } | Record<string, string> } }>,
): string {
  const fromMeta = drizzleLinks?.find((link) => {
    const params = link.to.params
    return !!params && 'modelKey' in params && params.modelKey === modelKey
  })?.label
  if (fromMeta) {
    return fromMeta
  }
  return toTitleCase(modelKey.replace(/-/g, ' '))
}

function splitLines(text: string): string[] {
  if (!text) {
    return []
  }
  return text.split(/(?<=\n)/)
}

function splitWords(text: string): string[] {
  if (!text) {
    return []
  }
  return text.split(/(\s+)/).filter(part => part.length > 0)
}

function mergeSegments(segments: AuditDiffSegment[]): AuditDiffSegment[] {
  const merged: AuditDiffSegment[] = []
  for (const segment of segments) {
    const last = merged[merged.length - 1]
    if (last && last.type === segment.type) {
      last.text += segment.text
    }
    else {
      merged.push({ type: segment.type, text: segment.text })
    }
  }
  return merged
}

type DiffOp = { type: 'equal' | 'remove' | 'add', text: string }

function lcsOps(a: string[], b: string[]): DiffOp[] {
  const m = a.length
  const n = b.length
  if (m === 0 && n === 0) {
    return []
  }
  const maxTokens = 2500
  if (m > maxTokens || n > maxTokens) {
    const ops: DiffOp[] = []
    if (m) {
      ops.push({ type: 'remove', text: a.join('') })
    }
    if (n) {
      ops.push({ type: 'add', text: b.join('') })
    }
    return ops
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i]![j] = (dp[i + 1]![j + 1] ?? 0) + 1
      }
      else {
        dp[i]![j] = Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0)
      }
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', text: a[i]! })
      i++
      j++
    }
    else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      ops.push({ type: 'remove', text: a[i]! })
      i++
    }
    else {
      ops.push({ type: 'add', text: b[j]! })
      j++
    }
  }
  while (i < m) {
    ops.push({ type: 'remove', text: a[i]! })
    i++
  }
  while (j < n) {
    ops.push({ type: 'add', text: b[j]! })
    j++
  }
  return mergeSegments(ops)
}

function opsToSides(ops: DiffOp[]): { before: AuditDiffSegment[], after: AuditDiffSegment[] } {
  const before: AuditDiffSegment[] = []
  const after: AuditDiffSegment[] = []
  for (const op of ops) {
    if (op.type === 'equal') {
      before.push({ type: 'equal', text: op.text })
      after.push({ type: 'equal', text: op.text })
    }
    else if (op.type === 'remove') {
      before.push({ type: 'remove', text: op.text })
    }
    else {
      after.push({ type: 'add', text: op.text })
    }
  }
  return {
    before: mergeSegments(before),
    after: mergeSegments(after),
  }
}

/** Replace adjacent remove/add hunks with a finer-grained token diff. */
function refineOps(
  ops: DiffOp[],
  retokenize: (text: string) => string[],
  options: { onlyIfSimilar?: boolean } = {},
): DiffOp[] {
  const refined: DiffOp[] = []
  let index = 0
  while (index < ops.length) {
    const op = ops[index]!
    if (op.type === 'equal') {
      refined.push(op)
      index++
      continue
    }

    const removed: string[] = []
    const added: string[] = []
    while (index < ops.length && ops[index]!.type !== 'equal') {
      const hunk = ops[index]!
      if (hunk.type === 'remove') {
        removed.push(hunk.text)
      }
      else {
        added.push(hunk.text)
      }
      index++
    }

    const removedText = removed.join('')
    const addedText = added.join('')
    if (!removedText || !addedText) {
      for (const text of removed) {
        refined.push({ type: 'remove', text })
      }
      for (const text of added) {
        refined.push({ type: 'add', text })
      }
      continue
    }

    // Skip expensive fine diffs on large divergent hunks.
    if (removedText.length * addedText.length > 80_000) {
      for (const text of removed) {
        refined.push({ type: 'remove', text })
      }
      for (const text of added) {
        refined.push({ type: 'add', text })
      }
      continue
    }

    if (options.onlyIfSimilar && !areNearEdits(removedText, addedText)) {
      for (const text of removed) {
        refined.push({ type: 'remove', text })
      }
      for (const text of added) {
        refined.push({ type: 'add', text })
      }
      continue
    }

    refined.push(...lcsOps(retokenize(removedText), retokenize(addedText)))
  }
  return mergeSegments(refined)
}

/** True when two strings look like a small edit of each other (shared affixes). */
function areNearEdits(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) {
    return true
  }
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++
  }
  let suffix = 0
  while (
    suffix < a.length - prefix
    && suffix < b.length - prefix
    && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++
  }
  const shared = prefix + suffix
  return shared >= maxLen * 0.6 || (shared >= 2 && (maxLen - shared) <= 6)
}

/**
 * Token LCS diff for display: Before shows equal + removals, After shows equal + additions.
 * Uses line → word → character refinement so tiny edits in long HTML are not whole-value highlights.
 */
export function diffAuditValues(before: unknown, after: unknown): {
  before: AuditDiffSegment[]
  after: AuditDiffSegment[]
} {
  const beforeText = formatAuditValue(before)
  const afterText = formatAuditValue(after)

  if (beforeText === afterText) {
    return {
      before: [{ type: 'equal', text: beforeText }],
      after: [{ type: 'equal', text: afterText }],
    }
  }

  const multiline = beforeText.includes('\n') || afterText.includes('\n')
  let ops = multiline
    ? lcsOps(splitLines(beforeText), splitLines(afterText))
    : lcsOps(splitWords(beforeText), splitWords(afterText))

  if (multiline) {
    ops = refineOps(ops, splitWords)
  }
  ops = refineOps(ops, text => Array.from(text), { onlyIfSimilar: true })

  return opsToSides(ops)
}
