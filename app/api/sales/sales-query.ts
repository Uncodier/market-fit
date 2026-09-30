type SalesQuery = {
  eq: (column: string, value: string) => SalesQuery
  in: (column: string, values: string[]) => SalesQuery
  gt: (column: string, value: string) => SalesQuery
  order: (column: string, options: { ascending: boolean }) => SalesQuery
  range: (start: number, end: number) => PromiseLike<{ data: unknown; error: unknown }>
}
export type SalesClient = { from: (table: string) => { select: (fields: string) => SalesQuery } }
export type ReportRefund = { id: string; sale_id: string; amount: number | string; currency: string; refunded_at: string }
export type ReportSale = {
  id: string
  amount: number | string | null
  amount_due?: number | string | null
  payments?: unknown
  refunds?: ReportRefund[]
  order_statuses?: string[]
  currency?: string | null
  status: string
  source?: string | null
  sale_date?: string | null
  created_at: string
  product_type?: string | null
  product_category?: string | null
}

export class SalesReportLimitError extends Error {}
export const SALES_REPORT_FIELDS = "id, amount, currency, status, source, sale_date, created_at, product_type"
export const SALES_FINANCIAL_FIELDS = `${SALES_REPORT_FIELDS}, amount_due, payments`

/** Immutable-ID keysets avoid offset shifts during inserts/deletes. Not an MVCC snapshot. */
export async function readSalesPages<T extends { id: string }>(
  query: () => SalesQuery,
  maxRows = 50_000,
): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | undefined
  const seen = new Set<string>()
  while (true) {
    let page = query().order("id", { ascending: true })
    if (cursor) page = page.gt("id", cursor)
    const { data, error } = await page.range(0, Math.min(499, maxRows - rows.length))
    if (error) throw new Error("Sales report query failed")
    if (!Array.isArray(data)) throw new Error("Invalid sales report query response")
    if (!data.length) return rows
    for (const row of data) {
      if (!row || typeof row.id !== "string" || !row.id || seen.has(row.id)) {
        throw new Error("Invalid or repeated sales report row")
      }
      seen.add(row.id)
      rows.push(row)
    }
    if (rows.length > maxRows) {
      throw new SalesReportLimitError("Too many sales records. Select a shorter period or a segment.")
    }
    cursor = rows[rows.length - 1].id
  }
}

/** Receipts can belong to older or future-dated sales, including cancelled sales. */
export async function queryReportSales(
  client: SalesClient,
  siteId: string,
  segmentId: string,
  maxRows = 50_000,
): Promise<ReportSale[]> {
  const base = () => {
    let query = client.from("sales").select(SALES_FINANCIAL_FIELDS)
      .eq("site_id", siteId)
    if (segmentId !== "all") query = query.eq("segment_id", segmentId)
    return query
  }
  try {
    return await readSalesPages<ReportSale>(base, maxRows)
  } catch (error) {
    if (error instanceof SalesReportLimitError) {
      throw new SalesReportLimitError("Too much sales history. Select a segment; payment dates require reading the complete sales history.")
    }
    throw error
  }
}