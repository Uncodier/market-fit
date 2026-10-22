/** @jest-environment node */
import { createPaymentEntry, remainingPaymentAmount, type PaymentEntry } from "@/app/pos/payment-math"
import { isolatedPostgres, postgresAvailable, uuid } from "../security/isolated-postgres"
import {
  installRegisterFixture, openSql, payment, registerIds, savePayments, summarySql,
} from "./register-postgres-fixture"

const suite = postgresAvailable ? describe : describe.skip

function tagged(entry: PaymentEntry | null, paymentId = registerIds.payment) {
  if (!entry) throw new Error("Expected a valid newly entered payment")
  return payment({ ...entry, payment_id: paymentId })
}

suite("POS payment math through the unchanged PostgreSQL receipt trigger", () => {
  const pg = isolatedPostgres()
  const receipts = () => JSON.parse(pg.call(`SELECT coalesce(jsonb_agg(jsonb_build_object(
    'method', method, 'amount', amount, 'tendered', tendered, 'change', change) ORDER BY id), '[]'::jsonb)
    FROM public.pos_register_receipts WHERE sale_id='${registerIds.sale}'`))
  const sale = () => pg.call(`SELECT to_jsonb(s) FROM public.sales s WHERE id='${registerIds.sale}'`)
  const summary = () => JSON.parse(pg.call(summarySql()))
  const setTotal = (amount: number) => pg.call(`UPDATE public.sales SET amount=${amount}, amount_due=${amount}
    WHERE id='${registerIds.sale}'`)

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installRegisterFixture(pg.db)
    pg.call(openSql())
  })

  it("persists cash 20 against 19.90 with exact numeric change of 0.10", () => {
    setTotal(19.9)
    const entry = createPaymentEntry("cash", "20", 19.9)
    pg.call(savePayments([tagged(entry)]))

    expect(receipts()).toEqual([{ method: "cash", amount: 19.9, tendered: 20, change: 0.1 }])
    // Evaluate the actual NUMERIC equality in PostgreSQL, with no rounding or tolerance.
    expect(pg.call(`SELECT amount = 19.90 AND tendered = 20 AND change = 0.10
      AND tendered - change = amount FROM public.pos_register_receipts WHERE id='${registerIds.payment}'`)).toBe("t")
    expect(summary()).toMatchObject({ receipt_count: 1, cash_received: 19.9, total_received: 19.9, expected_amount: 119.9 })
  })

  it("persists a mixed split with fractional cash change and no remaining balance", () => {
    setTotal(19.9)
    const first = createPaymentEntry("credit_card", "10", 19.9)!
    const remaining = remainingPaymentAmount(19.9, [first])
    expect(remaining).toBe(9.9)
    const second = createPaymentEntry("cash", "10", remaining)!
    pg.call(savePayments([tagged(first), tagged(second, uuid(131))]))

    expect(receipts()).toEqual([
      { method: "credit_card", amount: 10, tendered: 10, change: 0 },
      { method: "cash", amount: 9.9, tendered: 10, change: 0.1 },
    ])
    expect(pg.call("SELECT sum(amount) = 19.90 AND bool_and(tendered - change = amount) FROM public.pos_register_receipts")).toBe("t")
    expect(remainingPaymentAmount(19.9, [first, second])).toBe(0)
    expect(summary()).toMatchObject({ receipt_count: 2, cash_received: 9.9, total_received: 19.9, expected_amount: 109.9 })
  })

  it("persists fractional cash splits without generating a phantom third receipt", () => {
    setTotal(0.8)
    const first = createPaymentEntry("cash", "0.1", 0.8)!
    const second = createPaymentEntry("cash", "0.7", remainingPaymentAmount(0.8, [first]))!
    pg.call(savePayments([tagged(first), tagged(second, uuid(131))]))

    expect(receipts()).toEqual([
      { method: "cash", amount: 0.1, tendered: 0.1, change: 0 },
      { method: "cash", amount: 0.7, tendered: 0.7, change: 0 },
    ])
    expect(pg.call("SELECT sum(amount) = 0.80 AND bool_and(tendered - change = amount) FROM public.pos_register_receipts")).toBe("t")
    const remaining = remainingPaymentAmount(0.8, [first, second])
    expect(remaining).toBe(0)
    expect(createPaymentEntry("cash", "0.01", remaining)).toBeNull()
    expect(summary()).toMatchObject({ receipt_count: 2, cash_received: 0.8, total_received: 0.8, expected_amount: 100.8 })
  })

  it.each([false, true])("rejects the original floating change and rolls back the sale/receipts (earlier receipt: %s)", (includeEarlier) => {
    setTotal(includeEarlier ? 20 : 19.9)
    const before = sale()
    const original = tagged({ method: "cash", amount: 19.9, tendered: 20, change: 20 - 19.9 })
    expect(original.change).toBe(0.10000000000000142)
    const earlier = includeEarlier ? [tagged(createPaymentEntry("cash", "0.1", 20), uuid(131))] : []

    // When a valid receipt precedes the invalid one, the same statement must undo both.
    expect(() => pg.call(savePayments([...earlier, original]))).toThrow("balanced for cash")
    expect(sale()).toBe(before)
    expect(receipts()).toEqual([])
    expect(summary()).toMatchObject({ receipt_count: 0, cash_received: 0, total_received: 0, expected_amount: 100 })
  })
})