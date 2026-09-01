import { attachDemoAccounting } from "@/lib/demo-data/accounting"
import { applyDemoTimeline } from "@/lib/demo-data/timeline"

describe("demo accounting", () => {
  it("posts balanced sale and expense journal lines from source rows", () => {
    const data = attachDemoAccounting({
      sites: [{ id: "demo-ecom-es-456" }],
      sales: [
        { id: "s1", site_id: "demo-ecom-es-456", amount: 100, status: "completed", sale_date: "2026-08-20", currency: "EUR" },
      ],
      transactions: [
        { id: "t1", site_id: "demo-ecom-es-456", amount: 25, category: "freelance", date: "2026-08-21", currency: "EUR" },
      ],
    })

    expect(data.accounting_accounts.some((account: { code: string }) => account.code === "4000")).toBe(true)
    const saleLines = data.journal_lines.filter((line: { entry_id: string }) => line.entry_id === "je-sale-s1")
    const expenseLines = data.journal_lines.filter((line: { entry_id: string }) => line.entry_id === "je-exp-t1")
    const saleDebit = saleLines.reduce((sum: number, line: { debit: number }) => sum + line.debit, 0)
    const saleCredit = saleLines.reduce((sum: number, line: { credit: number }) => sum + line.credit, 0)
    expect(saleDebit).toBe(saleCredit)
    expect(saleLines.some((line: { account_code: string }) => line.account_code === "1000")).toBe(true)
    expect(expenseLines.some((line: { account_code: string; debit: number }) => line.account_code === "5400" && line.debit === 25)).toBe(true)
  })

  it("shifts historical sale dates into the recent window", () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const shifted = applyDemoTimeline({
      sales: [
        { id: "old", sale_date: "2025-11-16", created_at: "2025-11-16T00:00:00.000Z" },
        { id: "new", sale_date: "2026-05-14", created_at: "2026-05-14T00:00:00.000Z" },
      ],
      transactions: [],
    }, now)

    expect(shifted.sales[1].sale_date).toBe("2026-09-01")
    expect(shifted.sales[0].sale_date < shifted.sales[1].sale_date).toBe(true)
    expect(shifted.sales[0].sale_date >= "2026-04-01").toBe(true)
  })
})
