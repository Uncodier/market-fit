import { availableDemos, getDemoData } from "@/lib/demo-data"
import { attachDemoPayables, loadDemoAccountsPayable } from "@/lib/demo-data/accounts-payable"
import { filterPayables, localToday, payableStatus } from "@/app/accounts-payable/summary"

describe.each(availableDemos)("accounts payable demo: $id", ({ id }) => {
  it("uses existing suppliers and shared bills with every active status", async () => {
    const fixture = await getDemoData(id)
    const result = await loadDemoAccountsPayable(id)
    expect(result.error).toBeUndefined()
    expect(result.data).toHaveLength(3)
    expect(result.data.reduce((sum, account) => sum + account.invoiceCount, 0)).toBe(5)
    expect(new Set(result.data.map(account => payableStatus(account, localToday()))))
      .toEqual(new Set(["overdue", "current", "no_due_date"]))
    for (const account of result.data) {
      expect(fixture!.companies).toEqual(expect.arrayContaining([expect.objectContaining({ id: account.vendorId, name: account.name })]))
      for (const bill of account.bills) {
        expect(fixture!.purchases).toEqual(expect.arrayContaining([expect.objectContaining({ id: bill.id, site_id: id })]))
      }
    }
    expect(result.data.some(account => account.balances.length === 2)).toBe(true)
    const overdue = filterPayables(result.data, "overdue", "", "newest", localToday())
    expect(overdue[0].balances[0].amount).toBe(1650)
    expect(filterPayables(result.data, "all", result.data[0].name, "newest", localToday())).toHaveLength(1)
    const titles = result.data.flatMap(account => account.bills).map(bill => bill.title)
    for (const excluded of ["Draft service estimate", "Settled supplies invoice", "Cancelled equipment order"]) {
      expect(titles).not.toContain(excluded)
    }
  })

  it("keeps cancelled balances separate and refreshes without duplicate fixtures", async () => {
    const active = await loadDemoAccountsPayable(id)
    const cancelled = await loadDemoAccountsPayable(id, "cancelled")
    expect(cancelled.data).toHaveLength(1)
    expect(cancelled.data[0]).toMatchObject({ invoiceCount: 1, balances: [{ amount: 320 }] })
    expect(cancelled.data[0].bills[0].title).toBe("Cancelled equipment order")
    expect(active.data.flatMap(account => account.bills)).not.toContainEqual(cancelled.data[0].bills[0])
    const fixture = await getDemoData(id)
    const once = attachDemoPayables(fixture!, new Date("2026-11-03T12:00:00"))
    const twice = attachDemoPayables(once, new Date("2026-11-03T12:00:00"))
    expect(twice.purchases).toEqual(once.purchases)
    expect(new Set(twice.purchases.map((bill: { id: string }) => bill.id)).size).toBe(twice.purchases.length)
  })
})

it("rejects unknown demos and real workspace IDs without inventing balances", async () => {
  for (const id of ["demo-unknown", "11111111-1111-4111-8111-111111111111"]) {
    expect(await loadDemoAccountsPayable(id)).toEqual({ data: [], error: "Invalid accounts payable request" })
  }
  expect(await loadDemoAccountsPayable(availableDemos[0].id, "all" as never)).toHaveProperty("error")
  const real = { sites: [{ id: "real" }], companies: [{ id: "supplier" }], purchases: [] }
  expect(attachDemoPayables(real)).toBe(real)
})