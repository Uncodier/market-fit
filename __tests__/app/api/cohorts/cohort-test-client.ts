type Row = Record<string, any>
type Filter = { column: string; op: "eq" | "in" | "gte" | "lte"; value: any }
export interface QueryCall {
  table: string
  fields?: string
  filters: Filter[]
  orders: string[]
  from?: number
  to?: number
}

/** Query double executes filters and pages rather than returning pre-aggregated cohorts. */
export function cohortTestClient(
  tables: Record<string, Row[]>,
  options: { pageSize?: number; errors?: Record<string, string> } = {},
) {
  const calls: QueryCall[] = []
  const from = jest.fn((table: string) => {
    const call: QueryCall = { table, filters: [], orders: [] }
    calls.push(call)
    const execute = () => {
      if (options.errors?.[table]) return { data: null, error: { code: options.errors[table], message: "private database detail" } }
      let rows = (tables[table] ?? []).filter(row => call.filters.every(filter => {
        const actual = filter.column.split(".").reduce((value, key) => value?.[key], row)
        if (filter.op === "eq") return actual === filter.value
        if (filter.op === "in") return filter.value.includes(actual)
        if (filter.op === "gte") return actual >= filter.value
        return actual <= filter.value
      }))
      rows = [...rows].sort((a, b) => {
        for (const key of call.orders) {
          if (a[key] < b[key]) return -1
          if (a[key] > b[key]) return 1
        }
        return 0
      })
      if (call.from !== undefined) rows = rows.slice(call.from, Math.min(call.to! + 1, call.from + (options.pageSize ?? Infinity)))
      return { data: rows, error: null }
    }
    const query: any = {
      select: (fields: string) => { call.fields = fields; return query },
      eq: (column: string, value: any) => { call.filters.push({ column, value, op: "eq" }); return query },
      in: (column: string, value: any) => { call.filters.push({ column, value, op: "in" }); return query },
      gte: (column: string, value: any) => { call.filters.push({ column, value, op: "gte" }); return query },
      lte: (column: string, value: any) => { call.filters.push({ column, value, op: "lte" }); return query },
      order: (column: string) => { call.orders.push(column); return query },
      range: (start: number, end: number) => { call.from = start; call.to = end; return query },
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null } },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    }
    return query
  })
  return { client: { from }, calls }
}