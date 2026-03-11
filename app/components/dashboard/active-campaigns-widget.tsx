"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useRequestController } from "@/app/hooks/useRequestController";
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
  const { fetchWithController } = useRequestController();
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaignsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
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

  useEffect(() => {
    const fetchActiveCampaigns = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[ActiveCampaignsWidget] Widget execution disabled by context");
        return;
      }

      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      setHasError(false);
      
      try {
        // Validate dates - don't allow future dates
        const now = new Date();
        const validStartDate = startDate > now ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) : startDate;
        const validEndDate = endDate > now ? now : endDate;
        
        console.log("[ActiveCampaignsWidget] Fetching for site:", currentSite.id);
        const start = validStartDate ? format(validStartDate, "yyyy-MM-dd") : null;
        const end = validEndDate ? format(validEndDate, "yyyy-MM-dd") : null;
        
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        
        console.log("[ActiveCampaignsWidget] Requesting data with params:", Object.fromEntries(params.entries()));
        
        const response = await fetchWithRetry(
          fetchWithController,
          `/api/active-campaigns?${params.toString()}`,
          { maxRetries: 3 }
        );
        
        // Handle null response (all retries failed or request was cancelled)
        if (!response) {
          return;
        }
        
        const data = await response.json();
        setActiveCampaigns(data);
      } catch (error) {
        // Only log non-abort errors
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error("Error fetching active campaigns:", error);
        }
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveCampaigns();
  }, [shouldExecuteWidgets, startDate, endDate, currentSite, user, fetchWithController]);

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