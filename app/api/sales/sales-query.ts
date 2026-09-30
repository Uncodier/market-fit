import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"

export type SalesClient = { from: (table: string) => any }
export type ReportSale = {
  id: string
  amount: number | string | null
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

/** Range pages are stable by ID. Never return a partial report as a successful total. */
export async function readSalesPages<T>(
  query: () => any,
  maxRows = 50_000,
): Promise<T[]> {
  const rows: T[] = []
  while (true) {
    const { data, error } = await query().order("id", { ascending: true })
      .range(rows.length, Math.min(rows.length + 499, maxRows))
    if (error) throw new Error("Sales report query failed")
    if (!Array.isArray(data)) throw new Error("Invalid sales report query response")
    if (!data.length) return rows
    rows.push(...data)
    if (rows.length > maxRows) {
      throw new SalesReportLimitError("Too many sales records. Select a shorter period or a segment.")
    }
  }
}

export async function queryReportSales(
  client: SalesClient,
  siteId: string,
  segmentId: string,
  start: string,
  endExclusive: string,
  maxRows = 50_000,
): Promise<ReportSale[]> {
  const base = () => {
    let query = client.from("sales").select(SALES_REPORT_FIELDS)
      .eq("site_id", siteId).in("status", ["pending", "completed"])
    if (segmentId !== "all") query = query.eq("segment_id", segmentId)
    return query
  }
  // These scans are disjoint. A created date must never override an explicit sale date.
  const [dated, undated] = await Promise.all([
    readSalesPages<ReportSale>(() => base().gte("sale_date", start).lt("sale_date", endExclusive), maxRows),
    readSalesPages<ReportSale>(() => base().is("sale_date", null)
      .gte("created_at", `${start}T00:00:00.000Z`).lt("created_at", `${endExclusive}T00:00:00.000Z`), maxRows),
  ])
  if (dated.length + undated.length > maxRows) {
    throw new SalesReportLimitError("Too many sales records. Select a shorter period or a segment.")
  }
  return [...dated, ...undated].filter(isRecognizedRevenueSale)
}