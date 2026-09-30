import { NextRequest } from "next/server"

export const SITE = "00000000-0000-4000-8000-000000000001"
export const OTHER_SITE = "00000000-0000-4000-8000-000000000002"
export const SEGMENT = "00000000-0000-4000-8000-000000000003"
export const CAMPAIGN = "00000000-0000-4000-8000-000000000004"
type Row = Record<string, unknown>
type Filter = { op: string; column: string; value: unknown }
export type Query = { table: string; columns: string; filters: Filter[]; order: string; limit: number }
type Options = {
  serverLimit?: number
  failure?: (query: Query, index: number) => "error" | "throw" | "null" | undefined
}

export function costRequest(overrides: Record<string, string | undefined> = {}, authenticated = true) {
  const params = new URLSearchParams({ siteId: SITE, startDate: "2026-08-01", endDate: "2026-08-31" })
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) params.set(key, value)
  }
  return new NextRequest(`https://example.test/api/costs?${params}`, {
    headers: authenticated ? { cookie: "sb-test=fixture" } : {},
  })
}

export function transaction(id: string, date = "2026-08-31", extra: Row = {}): Row {
  return { id, site_id: SITE, date, amount: 10, type: "variable", category: "software", currency: "USD", ...extra }
}

export function purchase(id: string, extra: Row = {}): Row {
  return { id, site_id: SITE, purchase_date: "2026-08-31", amount: 100, status: "pending", currency: "USD", ...extra }
}

export function costClient(tables: Record<string, Row[] | undefined> = {}, options: Options = {}) {
  const queries: Query[] = []
  const from = jest.fn((table: string) => {
    const query: Query = { table, columns: "", filters: [], order: "", limit: Infinity }
    let single = false
    const execute = async () => {
      queries.push(query)
      const failure = options.failure?.(query, queries.length)
      if (failure === "throw") throw new Error("secret provider details")
      if (failure === "error") return { data: null, error: { message: "secret provider details" } }
      if (failure === "null") return { data: null, error: null }
      let rows = [...(tables[table] ?? [])]
      for (const filter of query.filters) {
        rows = rows.filter((row) => {
          const value = row[filter.column]
          if (filter.op === "eq") return value === filter.value
          if (filter.op === "in") return (filter.value as unknown[]).includes(value)
          if (filter.op === "gte") return String(value) >= String(filter.value)
          if (filter.op === "lt") return String(value) < String(filter.value)
          if (filter.op === "gt") return String(value) > String(filter.value)
          throw new Error(`Unexpected filter: ${filter.op}`)
        })
      }
      rows.sort((a, b) => String(a[query.order]).localeCompare(String(b[query.order])))
      rows = rows.slice(0, Math.min(query.limit, options.serverLimit ?? Infinity))
      return { data: single ? rows[0] ?? null : rows, error: null }
    }
    const builder = {
      select: (columns: string) => { query.columns = columns; return builder },
      eq: (column: string, value: unknown) => { query.filters.push({ op: "eq", column, value }); return builder },
      in: (column: string, value: unknown[]) => { query.filters.push({ op: "in", column, value }); return builder },
      gte: (column: string, value: unknown) => { query.filters.push({ op: "gte", column, value }); return builder },
      lt: (column: string, value: unknown) => { query.filters.push({ op: "lt", column, value }); return builder },
      gt: (column: string, value: unknown) => { query.filters.push({ op: "gt", column, value }); return builder },
      order: (column: string, opts: { ascending: boolean }) => {
        if (!opts.ascending) throw new Error("Expected ascending cursor order")
        query.order = column
        return builder
      },
      limit: (limit: number) => { query.limit = limit; return builder },
      maybeSingle: () => { single = true; return builder },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject),
    }
    return builder
  })
  return {
    from, queries,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null }) },
    rpc: jest.fn().mockResolvedValue({ data: "owner", error: null }),
  }
}