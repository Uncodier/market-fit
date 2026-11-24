import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { CreditTransactionRow, PaymentOperationRow, PayoutRow } from './payment-dashboard-types'

type Read<T> = { rows: T[]; failed?: false } | { failed: true; rows?: undefined }

// Keep a failed refresh distinct from a successful empty ledger, including under
// the workspace SWR middleware that can otherwise serve cached data on error.
async function readRows<T>(query: () => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<Read<T>> {
  try {
    const { data, error } = await query()
    if (!error && Array.isArray(data)) return { rows: data }
  } catch { /* Treat transport failures like database errors. */ }
  return { failed: true }
}

export function usePaymentDashboardData(siteId: string, actorId: string) {
  const options = { keepPreviousData: false }
  const payouts = useSWR(['payment-payouts', siteId, actorId], ([, id]) => readRows<PayoutRow>(() => createClient()
    .from('payout_requests').select('id, status, created_at, requested_credits')
    .eq('site_id', id).order('created_at', { ascending: false })), options)
  const operations = useSWR(['payment-operations', siteId, actorId], ([, id]) => readRows<PaymentOperationRow>(() => createClient()
    .from('payments').select('id, status, created_at, transaction_type, amount, details')
    .eq('site_id', id).in('transaction_type', ['sale', 'commission']).order('created_at', { ascending: false })), options)
  const transactions = useSWR(['payment-credit-history', siteId, actorId], ([, id]) => readRows<CreditTransactionRow>(() => createClient()
    .from('credit_transactions').select('amount, created_at').eq('site_id', id).order('created_at', { ascending: true })), options)
  return { payouts, operations, transactions }
}