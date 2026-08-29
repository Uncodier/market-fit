"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";

interface RevenueWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface RevenueData {
  actual: number;
  percentChange: number;
  periodType: string;
}

function formatPeriodType(periodType: string, t: (key: string) => string): string {
  switch (periodType) {
    case "daily": return t('dashboard.widgets.revenue.yesterday') || 'yesterday';
    case "weekly": return t('dashboard.widgets.revenue.lastWeek') || 'last week';
    case "monthly": return t('dashboard.widgets.revenue.lastMonth') || 'last month';
    case "quarterly": return t('dashboard.widgets.revenue.lastQuarter') || 'last quarter';
    case "yearly": return t('dashboard.widgets.revenue.lastYear') || 'last year';
    default: return t('dashboard.widgets.revenue.previousPeriod') || 'previous period';
  }
}

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

function mapRevenue(payload: any): RevenueData | null {
  if (!payload || payload.error) return null;
  return {
    actual: payload.totalSales?.actual || 0,
    percentChange: payload.totalSales?.percentChange || 0,
    periodType: payload.periodType || "monthly",
  };
}

export function RevenueWidget({
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: RevenueWidgetProps) {
  const { t } = useLocalization();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data, isLoading } = useOverviewSlice<any>("revenue", startDate, endDate, segmentId);
  const revenue = mapRevenue(data);

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.revenue') || 'Revenue'}
      tooltipText={t('dashboard.widgets.revenue.tooltip') || 'Total revenue for the selected period'}
      value={revenue ? formatCurrency(revenue.actual) : "$0"}
      changeText={`${revenue?.percentChange || 0}% from ${formatPeriodType(revenue?.periodType || "monthly", t)}`}
      isPositiveChange={(revenue?.percentChange || 0) > 0}
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
