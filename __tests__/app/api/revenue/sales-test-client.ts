type Row = Record<string, unknown>
type FilterName = "eq" | "in" | "is" | "gt" | "gte" | "lte" | "lt"
type QueryResult<T> = Promise<{ data: T; error: { message: string } | null }>
type Query = Record<FilterName | "select" | "order", (...args: unknown[]) => Query> & {
  range: (start: number, end: number) => QueryResult<Row[]>
  maybeSingle: () => QueryResult<Row | null>
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right
  if (typeof left === "string" && typeof right === "string") return left === right ? 0 : left < right ? -1 : 1
  return NaN
}

export function salesTestClient(tables: Record<string, Row[]>, cap = 500, errorTable?: string) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const from = jest.fn((table: string) => {
    let rows = [...(tables[table] || [])]
    const filters: Record<FilterName, (row: Row, column: string, value: unknown) => boolean> = {
      eq: (row, key, value) => row[key] === value,
      in: (row, key, values) => Array.isArray(values) && values.includes(row[key]),
      is: (row, key, value) => (row[key] ?? null) === value,
      gte: (row, key, value) => compare(row[key], value) >= 0,
      gt: (row, key, value) => compare(row[key], value) > 0,
      lte: (row, key, value) => compare(row[key], value) <= 0,
      lt: (row, key, value) => compare(row[key], value) < 0,
    }
    const filter = (name: FilterName, args: unknown[]) => {
      calls.push({ table, method: name, args })
      rows = rows.filter(row => filters[name](row, String(args[0]), args[1]))
      return query
    }
    const query: Query = {
      eq: (...args) => filter("eq", args),
      in: (...args) => filter("in", args),
      is: (...args) => filter("is", args),
      gte: (...args) => filter("gte", args),
      gt: (...args) => filter("gt", args),
      lte: (...args) => filter("lte", args),
      lt: (...args) => filter("lt", args),
      select: (...args) => {
        calls.push({ table, method: "select", args })
        return query
      },
      order: (...args) => {
        calls.push({ table, method: "order", args })
        rows.sort((a, b) => compare(a[String(args[0])], b[String(args[0])]))
        return query
      },
      range: async (start, end) => {
        calls.push({ table, method: "range", args: [start, end] })
        return { data: rows.slice(start, Math.min(start + cap, end + 1)), error: table === errorTable ? { message: "private database details" } : null }
      },
      maybeSingle: async () => {
        calls.push({ table, method: "maybeSingle", args: [] })
        const error = table === errorTable || rows.length > 1 ? { message: "private database details" } : null
        return { data: error ? null : rows[0] ?? null, error }
      },
    }
    return query
  })
  return { from, calls }
}