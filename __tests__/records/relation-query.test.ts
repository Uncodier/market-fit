import { getSiteCompanyIds } from "@/app/records/lib/relation-query"

function makeClient(rows: Record<string, unknown[]>, denied = false) {
  const filters: Array<[string, string, unknown]> = []
  const from = jest.fn((table: string) => {
    const query: { select: jest.Mock; not: jest.Mock; order: jest.Mock; range: jest.Mock; eq: jest.Mock; in: jest.Mock; then: (resolve: (value: unknown) => unknown) => Promise<unknown> } = {
      select: jest.fn(() => query), not: jest.fn(() => query), order: jest.fn(() => query),
      range: jest.fn(() => query),
      eq: jest.fn((key: string, value: unknown) => { filters.push([table, key, value]); return query }),
      in: jest.fn((key: string, value: unknown) => { filters.push([table, key, value]); return query }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] || [], error: denied ? {} : null }).then(resolve),
    }
    return query
  })
  return { client: { from } as never, filters, from }
}

it("derives distinct company IDs only from site-associated entities", async () => {
  const { client, filters, from } = makeClient({
    leads: [{ company_id: "one" }], deals: [{ company_id: "one" }], suppliers: [{ company_id: "two" }],
  })
  expect(await getSiteCompanyIds(client, "site", ["one", "two"])).toEqual(["one", "two"])
  for (const table of ["leads", "deals", "suppliers"]) {
    expect(filters).toContainEqual([table, "site_id", "site"])
    expect(filters).toContainEqual([table, "company_id", ["one", "two"]])
  }
  expect(from).not.toHaveBeenCalledWith("companies")
})

it("fails closed when association verification fails", async () => {
  await expect(getSiteCompanyIds(makeClient({}, true).client, "site")).rejects.toThrow(/verify company/)
})