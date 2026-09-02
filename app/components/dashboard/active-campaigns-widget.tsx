"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";

interface ActiveCampaignsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface ActiveCampaignsData {
  actual: number;
  percentChange: number;
  periodType: string;
  error?: string;
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

export function ActiveCampaignsWidget({
  startDate: propStartDate,
  endDate: propEndDate
}: ActiveCampaignsWidgetProps) {
  const { t } = useLocalization();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data: activeCampaigns, isLoading } = useOverviewSlice<ActiveCampaignsData>(
    "active-campaigns",
    startDate,
    endDate
  );

  const hasError = Boolean(activeCampaigns?.error);
  let customStatus = null;
  let formattedValue = null;
  let changeText = null;
  let isPositiveChange = undefined;

  if (hasError) {
    customStatus = <div className="text-sm text-red-500">Error loading campaigns data</div>;
  } else {
    formattedValue = activeCampaigns?.actual != null ? activeCampaigns.actual.toString() : "0";
    changeText = `${activeCampaigns?.percentChange || 0}% from ${formatPeriodType(activeCampaigns?.periodType || "monthly", t)}`;
    isPositiveChange = (activeCampaigns?.percentChange || 0) > 0;
  }

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.activeCampaigns') || 'Active Campaigns'}
      tooltipText={t('dashboard.widgets.activeCampaigns.tooltip') || 'Campaigns running in the selected time period'}
      value={formattedValue}
      changeText={changeText || ""}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      customStatus={customStatus}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={(start, end) => {
        setStartDate(start);
        setEndDate(end);
      }}
    />
  );
}
