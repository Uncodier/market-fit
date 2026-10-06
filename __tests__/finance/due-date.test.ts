import { formatDueDate, getSubscriptionInvoiceDueDate, isDateOnly, normalizeDueDate } from "@/lib/finance/due-date"

describe("financial calendar due dates", () => {
  it.each([null, undefined, ""])("keeps optional %s dates null", (value) => {
    expect(normalizeDueDate(value)).toBeNull()
  })
  it.each(["2026-02-30", "2026-2-01", "2026-10-06T00:00:00Z", "0000-01-01", "infinity", 123])("rejects %s", (value) => {
    expect(isDateOnly(value)).toBe(false)
    expect(() => normalizeDueDate(value)).toThrow("valid due date")
  })
  it("accepts leap days and renders the same calendar date in every browser timezone", () => {
    expect(normalizeDueDate("2028-02-29")).toBe("2028-02-29")
    expect(formatDueDate("2026-03-08")).toBe("Mar 8, 2026")
    expect(formatDueDate(null)).toBe("Not set")
  })
  it.each([
    ["2026-02-14", "2026-01-31", "2026-02-28", "2026-03-14"],
    ["2028-03-14", "2028-02-29", "2028-03-31", "2028-04-14"],
    ["2026-03-22", "2026-03-08T23:00:00-07:00", "2026-11-01", "2026-11-14"],
    ["2026-10-15", "2026-09-30T18:00:00-06:00", "2026-11-01", "2026-11-15"],
    ["2026-01-28", "2026-01-31", "2026-02-28", "2026-02-25"],
    ["2026-01-31", "2026-01-31", "2026-02-28", "2026-02-28"],
  ])("preserves offset from %s / %s on invoice %s", (due, billing, invoice, expected) => {
    expect(getSubscriptionInvoiceDueDate(due, billing, invoice)).toBe(expected)
  })
  it("does not invent dates for historical subscriptions without a due date or anchor", () => {
    expect(getSubscriptionInvoiceDueDate(null, "2026-01-31", "2026-02-28")).toBeNull()
    expect(getSubscriptionInvoiceDueDate("2026-02-14", undefined, "2026-02-28")).toBeNull()
  })
  it("fails invalid configured billing dates", () => {
    expect(() => getSubscriptionInvoiceDueDate("2026-02-14", "2026-02-30", "2026-02-28")).toThrow()
  })
})