import type { AdminModelConfig } from '#layers/autoadmin/server/utils/registry'
import type { Table } from 'drizzle-orm'
import { asc, inArray, sql } from 'drizzle-orm'

/**
 * Fetch all rows sorted by sortField ASC, lookupColumn ASC (deterministic).
 * Returns the ordered list of lookup values and a map of lookup -> current sortValue.
 */
export async function fetchSortedRows(db: any, cfg: AdminModelConfig<Table>) {
  const sortColumn = cfg.columns[cfg.sortField!]!
  const allRows = await db
    .select({ lookup: cfg.lookupColumn, sortValue: sortColumn })
    .from(cfg.model)
    .orderBy(asc(sortColumn), asc(cfg.lookupColumn))

  const allLookups: (string | number)[] = allRows.map((r: any) => r.lookup)
  const oldValues = new Map<string, number>(allRows.map((r: any) => [String(r.lookup), r.sortValue as number]))

  return { allLookups, oldValues }
}

/**
 * Assign sequential 0..N values to allLookups and batch-update only the rows
 * whose sort value actually changed.
 */
export async function resequenceAndUpdate(
  db: any,
  cfg: AdminModelConfig<Table>,
  allLookups: (string | number)[],
  oldValues: Map<string, number>,
) {
  const updates = new Map<string | number, number>()
  for (let i = 0; i < allLookups.length; i++) {
    const lookup = allLookups[i]!
    if (oldValues.get(String(lookup)) !== i) {
      updates.set(lookup, i)
    }
  }
  if (updates.size > 0) {
    await batchUpdate(db, cfg.model, cfg.sortField!, cfg.lookupColumn, updates)
  }
}

/**
 * Batch-update sort values using a single UPDATE ... SET = CASE statement.
 */
export async function batchUpdate(
  db: any,
  model: any,
  sortField: string,
  lookupColumn: any,
  updates: Map<string | number, number>,
) {
  const lookups = [...updates.keys()]
  const caseClauses = lookups.map(lookup => sql`WHEN ${lookupColumn} = ${lookup} THEN CAST(${updates.get(lookup)!} AS INTEGER)`)
  const caseExpr = sql.join([sql`CASE`, ...caseClauses, sql`END`], sql` `)

  await db.update(model).set({ [sortField]: caseExpr }).where(inArray(lookupColumn, lookups))
}
