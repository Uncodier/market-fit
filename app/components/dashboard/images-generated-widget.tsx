"use client"

import { BaseKpiWidget } from "./base-kpi-widget"
import { useLocalization } from "@/app/context/LocalizationContext"
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches"

interface ImagesGeneratedData {
  actual: number
  percentChange: number
  periodType: string
}

function formatPeriodType(periodType: string, t: (key: string) => string) {
  switch (periodType) {
    case "daily": return t("dashboard.widgets.revenue.yesterday") || "yesterday"
    case "weekly": return t("dashboard.widgets.revenue.lastWeek") || "last week"
    case "monthly": return t("dashboard.widgets.revenue.lastMonth") || "last month"
    default: return t("dashboard.widgets.revenue.previousPeriod") || "previous period"
  }
}

export function ImagesGeneratedWidget({
  startDate,
  endDate,
  segmentId = "all",
}: {
  startDate: Date
  endDate: Date
  segmentId?: string
}) {
  const { t } = useLocalization()
  const { data, isLoading } = usePerformanceSlice<ImagesGeneratedData>(
    "images-generated",
    startDate,
    endDate,
    segmentId
  )

  return (
    <BaseKpiWidget
      title={t("dashboard.widgets.imagesGenerated") || "Images Generated"}
      value={data?.actual?.toLocaleString() || "0"}
      changeText={`${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly", t)}`}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
    />
  )
}
