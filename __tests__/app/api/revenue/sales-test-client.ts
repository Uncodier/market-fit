type Row = Record<string, any>
export function salesTestClient(tables: Record<string, Row[]>, cap = 500, errorTable?: string) {
  const calls: Array<{ table: string; method: string; args: any[] }> = []
  const from = jest.fn((table: string) => {
    let rows = [...(tables[table] || [])]
    const query: Record<string, any> = {}
    const filters: Record<string, (row: Row, column: string, value: any) => boolean> = {
      eq: (row, key, value) => row[key] === value,
      in: (row, key, values) => values.includes(row[key]),
      is: (row, key, value) => (row[key] ?? null) === value,
      gte: (row, key, value) => row[key] != null && row[key] >= value,
      lte: (row, key, value) => row[key] != null && row[key] <= value,
      lt: (row, key, value) => row[key] != null && row[key] < value,
    }
    for (const [name, filter] of Object.entries(filters)) {
      query[name] = (...args: any[]) => {
        calls.push({ table, method: name, args })
        rows = rows.filter((row) => filter(row, args[0], args[1]))
        return query
      }
    }
    query.select = (...args: any[]) => { calls.push({ table, method: "select", args }); return query }
    query.order = (...args: any[]) => { calls.push({ table, method: "order", args }); return query }
    query.range = async (start: number, end: number) => {
      calls.push({ table, method: "range", args: [start, end] })
      return { data: rows.slice(start, Math.min(start + cap, end + 1)), error: table === errorTable ? { message: "private database details" } : null }
    }
    return query
  })
  return { from, calls }
}