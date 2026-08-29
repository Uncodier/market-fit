"use client";

import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches";

interface SalesKpiWidgetProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface SalesKpiData {
  actual: number;
  percentChange: number;
  periodType: string;
}

export function SalesKpiWidget({ 
  startDate, 
  endDate, 
  segmentId = "all" 
}: SalesKpiWidgetProps) {
  const { t } = useLocalization();
  const { data, isLoading } = usePerformanceSlice<SalesKpiData>(
    "sales",
    startDate,
    endDate,
    segmentId
  );

  const formatPeriodType = (periodType: string) => {
    switch (periodType) {
      case "daily": return t('dashboard.widgets.revenue.yesterday') || 'yesterday';
      case "weekly": return t('dashboard.widgets.revenue.lastWeek') || 'last week';
      case "monthly": return t('dashboard.widgets.revenue.lastMonth') || 'last month';
      default: return t('dashboard.widgets.revenue.previousPeriod') || 'previous period';
    }
  };

  const displayValue = data?.actual?.toLocaleString() || "0";
  const changeText = `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.sales') || 'Sales'}
      value={displayValue}
      changeText={changeText}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
    />
  );
}
