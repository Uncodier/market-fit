"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";
import { formatSalesChange, formatSalesMoney } from "@/lib/sales/report-format";

interface RevenueWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface RevenueData {
  actual: number;
  percentChange: number | null;
  periodType: string;
  currency: string;
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

function mapRevenue(payload: any): RevenueData | null {
  if (!payload?.totalSales || payload.error) return null;
  return {
    actual: payload.totalSales?.actual || 0,
    percentChange: payload.totalSales.percentChange ?? null,
    periodType: payload.periodType || "custom",
    currency: payload.currency || "UNSPECIFIED",
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
      value={revenue ? formatSalesMoney(revenue.actual, revenue.currency) : "Unavailable"}
      changeText={revenue ? `${formatSalesChange(revenue.percentChange)} · ${formatPeriodType(revenue.periodType, t)}` : "Sales report unavailable"}
      isPositiveChange={revenue?.percentChange == null || revenue.percentChange === 0 ? undefined : revenue.percentChange > 0}
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
