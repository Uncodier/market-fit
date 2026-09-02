"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";

interface CPLWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface CPLData {
  actual: number;
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

const formatCurrency = (value: number): string => {
  if (value == null || isNaN(value) || !isFinite(value)) {
    return "$0";
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function CPLWidget({
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: CPLWidgetProps) {
  const { t } = useLocalization();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data: cpl, isLoading } = useOverviewSlice<CPLData>("cpl", startDate, endDate, segmentId);

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.cpl') || 'CPL'}
      tooltipText="Cost Per Lead"
      value={cpl?.actual != null ? formatCurrency(cpl.actual) : "$0"}
      changeText={`${cpl?.percentChange || 0}% from ${formatPeriodType(cpl?.periodType || "monthly")}`}
      isPositiveChange={(cpl?.percentChange || 0) < 0}
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
