"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";

interface ROIWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface ROIData {
  actual: number;
  unit: string;
  percentChange: number;
  periodType: string;
}

const formatPeriodType = (periodType: string): string => {
  switch (periodType) {
    case "daily": return "yesterday";
    case "weekly": return "last week";
    case "monthly": return "last month";
    case "quarterly": return "last quarter";
    case "yearly": return "last year";
    default: return "previous period";
  }
};

export function ROIWidget({
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: ROIWidgetProps) {
  const { t } = useLocalization();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data: roi, isLoading } = useOverviewSlice<ROIData>("roi", startDate, endDate, segmentId);

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.roi') || 'ROI'}
      tooltipText="Return on Investment"
      value={roi ? `${roi.actual}${roi.unit}` : "0%"}
      changeText={`${roi?.percentChange || 0}% from ${formatPeriodType(roi?.periodType || "monthly")}`}
      isPositiveChange={(roi?.percentChange || 0) > 0}
      isLoading={isLoading}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={(start, end) => {
        setStartDate(start);
        setEndDate(end);
      }}
      segmentBadge={segmentId !== "all"}
    />
  );
}
