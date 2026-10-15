export type PayoutRow = {
  id: string
  status: string
  created_at: string
  requested_credits: number
}

export type PaymentOperationRow = {
  id: string
  status: string
  created_at: string
  transaction_type: string
  amount: number
  details?: {
    original_currency?: string
    commission_basis?: string
    commission_rate?: number | string
  } | null
}

export type CreditTransactionRow = {
  amount: number
  created_at: string
}