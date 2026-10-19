export type RegisterResult<T> = { data: T; error?: never } | { error: string; data?: never }

export type RegisterMovementKind = "cash_in" | "cash_out" | "cash_refund"

export type RegisterMovement = {
  id: string
  kind: RegisterMovementKind
  amount: number
  reason: string
  actor_id: string
  created_at: string
}

export type RegisterReceipt = {
  id: string
  sale_id: string
  method: string
  amount: number
  tendered: number
  change: number
  actor_id: string
  received_at: string
}

export type RegisterSummary = {
  opening_amount: number
  cash_received: number
  cash_in: number
  cash_out: number
  cash_refunds: number
  expected_amount: number
  total_received: number
  payment_totals: Record<string, number>
  receipt_count: number
  movements: RegisterMovement[]
  receipts: RegisterReceipt[]
}

export type RegisterSession = {
  id: string
  site_id: string
  location_id: string
  currency: string
  opened_by: string
  closed_by: string | null
  opened_at: string
  closed_at: string | null
  opening_amount: number
  counted_amount: number | null
  expected_amount: number | null
  difference: number | null
  notes: string
  status: "open" | "closed"
  snapshot: RegisterSummary | null
}

export type RegisterDashboard = {
  active: RegisterSession | null
  history: RegisterSession[]
  hasMore: boolean
  role: string
  userId: string
}