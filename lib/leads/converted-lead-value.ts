import type { AttributionData } from "@/app/leads/types"

type ConvertedLeadSource = {
  attribution?: AttributionData | null
  updated_at?: string | null
  created_at?: string | null
}

type SaleTotalSource = {
  lead_id?: string | null
  amount?: number | string | null
  status?: string | null
}

function toAmount(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function sumCompletedSalesByLead(
  sales: SaleTotalSource[]
): Record<string, number> {
  const totals: Record<string, number> = {}

  for (const sale of sales) {
    if (!sale.lead_id) continue
    const status = sale.status || "completed"
    if (status !== "completed") continue

    totals[sale.lead_id] = (totals[sale.lead_id] || 0) + toAmount(sale.amount)
  }

  return totals
}

export function convertedLeadValue(
  lead: ConvertedLeadSource,
  salesTotal?: number
): number {
  const fromSales = toAmount(salesTotal)
  if (fromSales > 0) return fromSales
  return toAmount(lead.attribution?.final_amount)
}

export function convertedLeadDate(lead: ConvertedLeadSource): string | null {
  return lead.attribution?.date || lead.updated_at || lead.created_at || null
}
