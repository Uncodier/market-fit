import {
  createPaymentEntry,
  remainingPaymentAmount,
  type PaymentEntry,
} from "@/app/pos/payment-math"

// Check decimal values as serialized for SQL, not a floating-point subtraction
// or a tolerance that could hide the original receipt-guard violation.
function serializedCents(amount: number): number {
  const serialized = JSON.stringify(amount)
  expect(serialized).toMatch(/^\d+(\.\d{1,2})?$/)
  const [whole, fraction = ""] = serialized.split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
}

describe("new POS payment math", () => {
  it.each([
    ["20", 19.9, 0.1],
    ["1", 0.9, 0.1],
    ["50", 37.45, 12.55],
  ])("normalizes cash %s against %s to exact decimal change", (input, remaining, change) => {
    const payment = createPaymentEntry("cash", input, remaining)!
    expect(payment).toEqual({ method: "cash", amount: remaining, tendered: Number(input), change })
    const serialized: PaymentEntry = JSON.parse(JSON.stringify(payment))
    expect(serializedCents(serialized.tendered) - serializedCents(serialized.change))
      .toBe(serializedCents(serialized.amount))
  })

  it("rounds the entered tender and applied amount before calculating change", () => {
    expect(createPaymentEntry("cash", "20.006", 19.904)).toEqual({
      method: "cash", amount: 19.9, tendered: 20.01, change: 0.11,
    })
    expect(createPaymentEntry("cash", "1.005", 10)).toEqual({
      method: "cash", amount: 1.01, tendered: 1.01, change: 0,
    })
  })

  it.each(["cash", "credit_card", "debit_card", "transfer", "other"])(
    "keeps exact and partial %s payments at currency precision", (method) => {
      expect(createPaymentEntry(method, "19.90", 19.9)).toEqual({ method, amount: 19.9, tendered: 19.9, change: 0 })
      expect(createPaymentEntry(method, "5.555", 19.9)).toEqual({ method, amount: 5.56, tendered: 5.56, change: 0 })
    },
  )

  it.each(["credit_card", "debit_card", "transfer", "other"])(
    "caps non-cash %s overpayment without cash change", (method) => {
      expect(createPaymentEntry(method, "20", 19.9)).toEqual({ method, amount: 19.9, tendered: 19.9, change: 0 })
    },
  )

  it("normalizes a mixed split balance and the final cash change", () => {
    const first = createPaymentEntry("credit_card", "10", 19.9)!
    const remaining = remainingPaymentAmount(19.9, [first])
    expect(remaining).toBe(9.9)
    const second = createPaymentEntry("cash", "10", remaining)!
    expect(second).toEqual({ method: "cash", amount: 9.9, tendered: 10, change: 0.1 })
    expect(remainingPaymentAmount(19.9, [first, second])).toBe(0)
  })

  it("does not create a phantom remainder or zero-value extra payment", () => {
    const payments = [
      createPaymentEntry("cash", "0.10", 0.8)!,
      createPaymentEntry("cash", "0.70", 0.7)!,
    ]
    expect(0.8 - payments.reduce((sum, payment) => sum + payment.amount, 0)).toBeGreaterThan(0)
    const remaining = remainingPaymentAmount(0.8, payments)
    expect(remaining).toBe(0)
    expect(createPaymentEntry("cash", "1", remaining)).toBeNull()
    expect(createPaymentEntry("cash", "1", Number.EPSILON)).toBeNull()
  })

  it("rounds a derived total and keeps an overpaid balance at zero", () => {
    expect(remainingPaymentAmount(0.1 + 0.2, [])).toBe(0.3)
    expect(remainingPaymentAmount(10, [{ amount: 20 }])).toBe(0)
  })

  it.each(["", " ", "not money", "20cash", "1.2.3", "NaN", "Infinity", "-Infinity", "1e309", "1e308", "0", "-1", "0.001"])(
    "rejects invalid or rounded-to-zero input %j", (input) => {
      expect(createPaymentEntry("cash", input, 19.9)).toBeNull()
      expect(createPaymentEntry("credit_card", input, 19.9)).toBeNull()
    },
  )

  it.each([NaN, Infinity, -Infinity, 1e308, -1, 0, 0.001])("rejects an invalid balance %s", (balance) => {
    expect(createPaymentEntry("cash", "20", balance)).toBeNull()
  })
})