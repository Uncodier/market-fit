import { format, subDays } from "date-fns"
import type { CreditTransactionRow, PaymentOperationRow, PayoutRow } from "./payment-dashboard-types"

export function buildPaymentBalanceHistory({
  usableCredits, withdrawableBalance, allTransactions, visibleOperations, payouts, now = new Date(),
}: {
  usableCredits: number
  withdrawableBalance: number
  allTransactions?: CreditTransactionRow[]
  visibleOperations: PaymentOperationRow[]
  payouts?: PayoutRow[]
  now?: Date
}) {
  // Extract balance history
  const chartData = []
  
  // Calculate running balance for every day in the last 14 days backwards
  let runningBalance = usableCredits + withdrawableBalance

  if (allTransactions || visibleOperations || payouts) {
    for (let i = 0; i < 14; i++) {
      const date = subDays(now, i)
      
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      
      // Filter transactions exactly on this date
      const txOnDate = (allTransactions || []).filter(tx => {
        const txDate = new Date(tx.created_at)
        return txDate >= startOfDay && txDate <= endOfDay
      })
      
      const salesOnDate = visibleOperations.filter(op => op.transaction_type === 'sale' && new Date(op.created_at) >= startOfDay && new Date(op.created_at) <= endOfDay)
      const commissionsOnDate = visibleOperations.filter(op => op.transaction_type === 'commission' && new Date(op.created_at) >= startOfDay && new Date(op.created_at) <= endOfDay)
      
      const payoutsOnDate = (payouts || []).filter(p => {
        const pDate = new Date(p.created_at)
        return pDate >= startOfDay && pDate <= endOfDay && p.status !== 'rejected'
      })
      
      const creditsAdded = txOnDate.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + Number(tx.amount), 0)
      const creditsConsumed = txOnDate.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)
      
      // Gross sales added to balance
      const balanceAdded = salesOnDate.reduce((sum, op) => sum + Number(op.amount), 0)
      
      // Commissions and withdrawals consumed from balance
      const commissionDeducted = commissionsOnDate.reduce((sum, op) => sum + Number(op.amount), 0)
      const balanceConsumed = payoutsOnDate.reduce((sum, p) => sum + Number(p.requested_credits), 0)
      
      const netBalanceAdded = balanceAdded - commissionDeducted
      
      const dailyOperations = creditsAdded + netBalanceAdded
      const dailyConsumed = creditsConsumed + balanceConsumed
        
      chartData.unshift({
        date: format(date, "MMM dd"),
        operations: Number(dailyOperations.toFixed(2)),
        consumed: Number(dailyConsumed.toFixed(2)),
        balance: Number(Math.max(0, runningBalance).toFixed(2)),
        sales: Number(netBalanceAdded.toFixed(2)),
        withdrawals: Number(balanceConsumed.toFixed(2))
      })
      
      runningBalance = runningBalance - dailyOperations + dailyConsumed
    }
  }

  return chartData
}
