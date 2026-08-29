"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";

interface ActiveUsersWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface PaidActiveUsersData {
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

export function ActiveUsersWidget({
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: ActiveUsersWidgetProps) {
  const { t } = useLocalization();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data: activeUsers, isLoading } = useOverviewSlice<PaidActiveUsersData>(
    "active-users",
    startDate,
    endDate,
    segmentId
  );

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.activeUsers.paid') || 'Paid Active Users'}
      tooltipText={t('dashboard.widgets.activeUsers.tooltip') || 'Number of unique users who made purchases in the selected period'}
      value={activeUsers?.actual?.toString() || "0"}
      changeText={`${activeUsers?.percentChange || 0}% from ${formatPeriodType(activeUsers?.periodType || "monthly", t)}`}
      isPositiveChange={(activeUsers?.percentChange || 0) > 0}
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
