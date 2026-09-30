import { CostReportError } from "./cost-input"

export const COST_PAGE_SIZE = 500
export const MAX_COST_ROWS = 10_000
export const MAX_COST_ITEM_ROWS = 20_000
export const MAX_COST_QUERIES = 200
export const COST_ITEM_BATCH_SIZE = 100

export type CostQueryBudget = { remaining: number }
type PageResult<T> = { data: T[] | null; error: unknown }

export function consumeCostQuery(budget: CostQueryBudget) {
  if (budget.remaining-- <= 0) {
    throw new CostReportError("Cost report is too large. Narrow the date range or filters.", 400)
  }
}

/** Continue to an empty page: a server-side row limit may be smaller than our page size. */
export async function readCostPages<T>(
  page: (after: string | null, limit: number) => PromiseLike<PageResult<T>>,
  key: (row: T) => string,
  budget: CostQueryBudget,
  maxRows = MAX_COST_ROWS,
): Promise<T[]> {
  const rows: T[] = []
  let after: string | null = null
  while (true) {
    consumeCostQuery(budget)
    const limit = Math.min(COST_PAGE_SIZE, maxRows - rows.length + 1)
    const { data, error } = await page(after, limit)
    if (error || !Array.isArray(data) || data.length > limit) {
      throw new CostReportError("Failed to load cost report data. Please try again.")
    }
    if (!data.length) return rows
    if (rows.length + data.length > maxRows) {
      throw new CostReportError("Cost report is too large. Narrow the date range or filters.", 400)
    }
    for (const row of data) {
      const next = key(row)
      if (typeof next !== "string" || !next || (after !== null && next <= after)) {
        throw new CostReportError("Failed to load complete cost report data. Please try again.")
      }
      after = next
      rows.push(row)
    }
  }
}