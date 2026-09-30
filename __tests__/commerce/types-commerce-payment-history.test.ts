import { buildPaymentBalanceHistory } from "@/app/payments/payment-balance-history"

describe("typed payment balance history", () => {
  const now = new Date(2026, 8, 30, 12)
  const today = new Date(2026, 8, 30, 10).toISOString()

  it("retains sales less commissions, credit consumption and non-rejected withdrawals", () => {
    const history = buildPaymentBalanceHistory({
      now, usableCredits: 120, withdrawableBalance: 50,
      allTransactions: [
        { amount: 30, created_at: today },
        { amount: -12, created_at: today },
      ],
      visibleOperations: [
        { id: "sale", transaction_type: "sale", amount: 100, created_at: today, status: "completed" },
        { id: "commission", transaction_type: "commission", amount: 10, created_at: today, status: "completed" },
      ],
      payouts: [
        { id: "paid", requested_credits: 20, created_at: today, status: "completed" },
        { id: "pending", requested_credits: 5, created_at: today, status: "pending" },
        { id: "rejected", requested_credits: 99, created_at: today, status: "rejected" },
      ],
    })
    expect(history).toHaveLength(14)
    expect(history[13]).toEqual({ date: "Sep 30", operations: 120, consumed: 37, balance: 170, sales: 90, withdrawals: 25 })
    expect(history[12]).toEqual({ date: "Sep 29", operations: 0, consumed: 0, balance: 87, sales: 0, withdrawals: 0 })
  })

  it("preserves the empty 14-day chart and clamps display balances at zero", () => {
    const history = buildPaymentBalanceHistory({ now, usableCredits: -5, withdrawableBalance: 0, visibleOperations: [] })
    expect(history).toHaveLength(14)
    expect(history.every((day) => day.balance === 0 && day.operations === 0 && day.consumed === 0)).toBe(true)
    expect(history[0].date).toBe("Sep 17")
  })
})