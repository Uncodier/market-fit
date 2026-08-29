"use client"

import { BaseKpiWidget } from "./base-kpi-widget"
import { useLocalization } from "@/app/context/LocalizationContext"
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches"

interface TokensData {
  actual: number
  percentChange: number
  periodType: string
  breakdown?: {
    inputTokens?: number
    outputTokens?: number
  }
}

function formatPeriodType(periodType: string, t: (key: string) => string) {
  switch (periodType) {
    case "daily": return t("dashboard.widgets.revenue.yesterday") || "yesterday"
    case "weekly": return t("dashboard.widgets.revenue.lastWeek") || "last week"
    case "monthly": return t("dashboard.widgets.revenue.lastMonth") || "last month"
    default: return t("dashboard.widgets.revenue.previousPeriod") || "previous period"
  }
}

export function OutputTokensWidget({
  startDate,
  endDate,
  segmentId = "all",
}: {
  startDate: Date
  endDate: Date
  segmentId?: string
}) {
  const { t } = useLocalization()
  const { data, isLoading } = usePerformanceSlice<TokensData>(
    "tokens",
    startDate,
    endDate,
    segmentId
  )
  const outputTokens = data?.breakdown?.outputTokens || 0

  return (
    <BaseKpiWidget
      title={t("dashboard.widgets.outputTokens") || "Output Tokens"}
      value={outputTokens.toLocaleString()}
      changeText={`${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly", t)}`}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
    />
  )
}
