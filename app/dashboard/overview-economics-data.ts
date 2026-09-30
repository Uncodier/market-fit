import type { ReportBatch } from "@/lib/dashboard/report-groups"
import { salesCurrency } from "@/lib/sales/report-format"

type Metric = { value: number | null; currency: string; note: string }
export type EconomicsBar = { name: string; value: number; color: string }

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

export function economicsNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function monetaryMetric(payload: unknown, note: string): Metric {
  const data = record(payload)
  const actual = economicsNumber(data.actual)
  return {
    value: data.noData === true || actual === null || actual < 0 ? null : actual,
    currency: salesCurrency(data.currency),
    note,
  }
}

// These endpoints provide snapshots, not a historical series. Never reconstruct
// previous values from percentage changes or invent lifetime/currency guarantees.
export function buildOverviewEconomics(data?: ReportBatch) {
  const ltv = monetaryMetric(data?.ltv, "Reported customer-value estimate")
  const cacData = record(data?.cac)
  const cacDetails = record(cacData.details)
  const cac = monetaryMetric(cacData, cacData.actual === -1 || cacData.noData === true
    ? "No observed conversions"
    : cacDetails.costSource === "campaign_budget" ? "Based on campaign budget" : "Reported acquisition cost")
  const cplData = record(data?.cpl)
  const cplMetadata = record(cplData.metadata)
  const cpl = monetaryMetric(cplData, "Recorded cost per created lead")
  const leadCount = economicsNumber(cplMetadata.leadsCount)
  if (leadCount === 0) cpl.value = null

  const matchingCurrency = ltv.currency !== "UNSPECIFIED" && ltv.currency === cac.currency
  const valueBars: EconomicsBar[] = matchingCurrency ? [
    ...(ltv.value === null ? [] : [{ name: "Customer value", value: ltv.value, color: "#6366f1" }]),
    ...(cac.value === null ? [] : [{ name: "Acquisition cost", value: cac.value, color: "#f59e0b" }]),
  ] : []

  const roiData = record(data?.roi)
  const details = record(roiData.details)
  const revenue = economicsNumber(details.totalRevenue)
  const transactions = economicsNumber(details.totalTransactions)
  const budget = economicsNumber(details.campaignBudget)
  const cost = transactions !== null && transactions > 0 ? transactions
    : budget !== null && budget > 0 ? budget : null
  const costLabel = transactions !== null && transactions > 0 ? "Recorded cost" : "Campaign budget"
  const returnAvailable = roiData.noData !== true && revenue !== null && revenue >= 0 && cost !== null
  // The legacy API substitutes 100% when no costs exist. That is not measurable ROI.
  const roi = returnAvailable ? (revenue - cost) / cost * 100 : null
  const returnBars: EconomicsBar[] = returnAvailable ? [
    { name: "Recorded revenue", value: revenue, color: "#6366f1" },
    { name: costLabel, value: cost, color: "#f59e0b" },
  ] : []

  return {
    ltv, cac, cpl, roi, valueBars, returnBars, matchingCurrency, leadCount,
    valueCurrency: matchingCurrency ? ltv.currency : "UNSPECIFIED",
    returnCurrency: salesCurrency(roiData.currency),
    costLabel,
    returnNote: roi === null ? "Needs revenue and a positive cost baseline"
      : costLabel === "Campaign budget" ? "Estimated from campaign budget" : "From recorded revenue and cost",
  }
}