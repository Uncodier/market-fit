"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useRequestController } from "@/app/hooks/useRequestController";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";

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

// Format period type for display
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

export function ActiveUsersWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: ActiveUsersWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const { fetchWithController } = useRequestController();
  const [activeUsers, setActiveUsers] = useState<PaidActiveUsersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    const fetchActiveUsers = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[PaidActiveUsersWidget] Widget execution disabled by context");
        return;
      }

      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
        const end = endDate ? format(endDate, "yyyy-MM-dd") : null;
        
        const params = new URLSearchParams();
        params.append("segmentId", segmentId);
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        
        const response = await fetchWithRetry(
          fetchWithController,
          `/api/active-users?${params.toString()}`,
          { maxRetries: 3 }
        );
        
        // Handle null response (all retries failed or request was cancelled)
        if (!response) {
          return;
        }
        const data = await response.json();
        setActiveUsers(data);
      } catch (error) {
        // Only log non-abort errors
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error("Error fetching paid active users:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveUsers();
  }, [shouldExecuteWidgets, segmentId, startDate, endDate, currentSite, user, fetchWithController]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = activeUsers?.actual?.toString() || "0";
  const changeText = `${activeUsers?.percentChange || 0}% from ${formatPeriodType(activeUsers?.periodType || "monthly")}`;
  const isPositiveChange = (activeUsers?.percentChange || 0) > 0;
  
  return (
    <BaseKpiWidget
      title="Paid Active Users"
      tooltipText="Number of unique users who made purchases in the selected period"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
      segmentBadge={segmentId !== "all"}
    />
  );
} 