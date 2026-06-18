"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";
import { useLocalization } from "@/app/context/LocalizationContext";

interface ActiveCampaignsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface ActiveCampaignsData {
  actual: number;
  percentChange: number;
  periodType: string;
}

// Format period type for display
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
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  // Update local state when props change
  useEffect(() => {
    if (propStartDate) {
      setStartDate(propStartDate);
    }
    if (propEndDate) {
      setEndDate(propEndDate);
    }
  }, [propStartDate, propEndDate]);

  const { data: activeCampaigns, isLoading: isSWRisLoading, error } = useSWR(
    shouldExecuteWidgets && currentSite && currentSite.id !== "default"
      ? [
          'active-campaigns',
          currentSite.id,
          user?.id,
          startDate ? format(startDate, "yyyy-MM-dd") : null,
          endDate ? format(endDate, "yyyy-MM-dd") : null
        ]
      : null,
    async ([_, siteId, userId, start, end]) => {
      const now = new Date();
      // Ensure we re-parse dates locally to validate if needed
      const validStartDate = startDate > now ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) : startDate;
      const validEndDate = endDate > now ? now : endDate;
      
      const startStr = validStartDate ? format(validStartDate, "yyyy-MM-dd") : null;
      const endStr = validEndDate ? format(validEndDate, "yyyy-MM-dd") : null;

      const params = new URLSearchParams();
      params.append("siteId", siteId as string);
      if (userId) {
        params.append("userId", userId as string);
      }
      if (startStr) params.append("startDate", startStr as string);
      if (endStr) params.append("endDate", endStr as string);
      
      const response = await fetchWithRetry(
        fetch,
        `/api/active-campaigns?${params.toString()}`,
        { maxRetries: 3 }
      );
      
      if (!response) {
        return null;
      }
      
      return await response.json() as ActiveCampaignsData;
    }
  );

  const isLoading = isSWRisLoading;
  const hasError = !!error;

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = activeCampaigns ? activeCampaigns.actual.toString() : "0";
  const changeText = `${activeCampaigns?.percentChange || 0}% from ${formatPeriodType(activeCampaigns?.periodType || "monthly", t)}`;
  const isPositiveChange = (activeCampaigns?.percentChange || 0) > 0;
  
  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.activeCampaigns') || 'Active Campaigns'}
      tooltipText={t('dashboard.widgets.activeCampaigns.tooltip') || 'Campaigns running in the selected time period'}
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
    />
  );
} 