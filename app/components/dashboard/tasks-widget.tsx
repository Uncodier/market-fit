"use client"

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { useLocalization } from "@/app/context/LocalizationContext"
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches"

interface TasksData {
  actual: number
  percentChange: number
  periodType: string
}

export function TasksWidget({ 
  segmentId, 
  startDate, 
  endDate 
}: { 
  segmentId: string
  startDate: Date
  endDate: Date 
}) {
  const { t } = useLocalization()
  const { data, isLoading } = usePerformanceSlice<TasksData>(
    "tasks",
    startDate,
    endDate,
    segmentId || "all"
  )

  const formatPeriodType = (periodType: string) => {
    switch (periodType) {
      case "daily": return t('dashboard.widgets.revenue.yesterday') || 'yesterday';
      case "weekly": return t('dashboard.widgets.revenue.lastWeek') || 'last week';
      case "monthly": return t('dashboard.widgets.revenue.lastMonth') || 'last month';
      case "quarterly": return t('dashboard.widgets.revenue.lastQuarter') || 'last quarter';
      case "yearly": return t('dashboard.widgets.revenue.lastYear') || 'last year';
      default: return t('dashboard.widgets.revenue.previousPeriod') || 'last period';
    }
  };

  const changeText = `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.tasks') || 'Tasks'}
      value={data?.actual || 0}
      changeText={changeText}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
    />
  )
}