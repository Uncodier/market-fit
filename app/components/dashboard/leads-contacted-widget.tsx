"use client";

import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches";

interface LeadsContactedWidgetProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface LeadsContactedData {
  actual: number;
  percentChange: number;
  periodType: string;
}

export function LeadsContactedWidget({
  startDate,
  endDate,
  segmentId = "all",
}: LeadsContactedWidgetProps) {
  const { t } = useLocalization();
  const { data, isLoading } = usePerformanceSlice<LeadsContactedData>(
    "leads-contacted",
    startDate,
    endDate,
    segmentId
  );

  const formatPeriodType = (periodType: string) => {
    switch (periodType) {
      case "daily": return "yesterday";
      case "weekly": return "last week";
      case "monthly": return "last month";
      default: return "previous period";
    }
  };

  const displayValue = data?.actual?.toLocaleString() || "0";
  const changeText = `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.leadsContacted') || 'Leads Contacted'}
      value={displayValue}
      changeText={changeText}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
    />
  );
}
