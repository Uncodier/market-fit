import { reportMetricKeys, type ReportBatch } from "@/lib/dashboard/report-groups"
import { buildOverviewEconomics } from "../overview-economics-data"
import { overviewRevenueSchema } from "./report-export-financial"
import { fields, metricSchema, periodSchema, record, type ExportSchema } from "./report-export-projection"

function activitySchema(section: string): ExportSchema {
  const series = section === "operations" ? fields("leadsCreated", "tasks")
    : fields("conversations", "engagement", "meetings", "sales")
  return { ...metricSchema, chartData: [{ date: true, ...series }], breakdown: series }
}

export function performanceSchema(section: string, activityOnly = false): ExportSchema {
  const keys = activityOnly ? ["metrics-overview"] : reportMetricKeys("performance", section) ?? []
  return Object.fromEntries(keys.map(key => [key,
    key === "metrics-overview" ? activitySchema(section) : key === "tokens" ? {
      ...metricSchema,
      chartData: [fields("date", "commands", "instanceLogs", "inputTokens", "outputTokens")],
      breakdown: fields("commands", "instanceLogs", "inputTokens", "outputTokens"),
    } : metricSchema,
  ]))
}

const economicDetails: Record<string, ExportSchema> = {
  ltv: fields("purchaseTasksCount", "convertedLeadsCount", "salesWithLeadsCount", "dataSource"),
  cac: fields("campaignCount", "campaignBudget", "transactionsCost", "salesCount", "conversionCount", "costSource", "warning"),
  roi: fields("campaignCount", "campaignBudget", "convertedLeadsCount", "totalRevenue", "transactionsCount", "totalTransactions"),
  cpl: {},
}
const economicsViewSchema: ExportSchema = {
  ltv: fields("value", "currency", "note"), cac: fields("value", "currency", "note"), cpl: fields("value", "currency", "note"),
  ...fields("roi", "matchingCurrency", "leadCount", "valueCurrency", "returnCurrency", "costLabel", "returnNote"),
  valueBars: [fields("name", "value")], returnBars: [fields("name", "value")],
}

export function overviewSchema(section: string): ExportSchema {
  const schema = Object.fromEntries((reportMetricKeys("overview", section) ?? []).map(key => [key,
    key === "revenue" ? overviewRevenueSchema : section === "economics" ? {
      ...fields("periodType", "noData", "currency", "unit"), details: economicDetails[key],
      ...(key === "cpl" ? { metadata: {
        ...periodSchema, ...fields("leadsCount", "prevLeadsCount", "totalCosts", "prevTotalCosts"),
      } } : {}),
    } : metricSchema,
  ]))
  return section === "economics" ? { ...schema, economics: economicsViewSchema } : schema
}

export function economicsData(input: unknown): unknown {
  const source = record(input)
  // Export source bases/coverage separately, but only the helper's nullable metric values.
  // Legacy source actual/comparison fields can contain non-measurement sentinels.
  return { ...source, economics: buildOverviewEconomics(source as ReportBatch) }
}