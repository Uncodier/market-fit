"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";

interface CACWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface CACData {
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
  if (value === -1) return "∞";
  if (value == null || isNaN(value) || !isFinite(value)) return "$0";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function CACWidget({
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: CACWidgetProps) {
  const { t } = useLocalization();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data: cac, isLoading } = useOverviewSlice<CACData>("cac", startDate, endDate, segmentId);
  const changeText = cac && cac.actual === -1
    ? "No conversions"
    : `${cac?.percentChange || 0}% from ${formatPeriodType(cac?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.cac') || 'CAC'}
      tooltipText="Customer Acquisition Cost"
      value={cac ? formatCurrency(cac.actual) : "$0"}
      changeText={changeText}
      isPositiveChange={(cac?.percentChange || 0) < 0}
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
