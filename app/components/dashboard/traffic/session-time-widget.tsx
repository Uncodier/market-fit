"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useRequestController } from "@/app/hooks/useRequestController";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";

const formatPeriodType = (periodType: string): string => {
  switch (periodType) {
    case "daily":
      return "yesterday";
    case "weekly":
      return "last week";
    case "monthly":
      return "last month";
    case "quarterly":
      return "last quarter";
    case "yearly":
      return "last year";
    default:
      return "previous period";
  }
};

const formatSessionTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

interface SessionTimeData {
  actual: number;
  percentChange: number;
  periodType: string;
}

interface SessionTimeWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function SessionTimeWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: SessionTimeWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const { fetchWithController } = useRequestController();
  const [sessionTime, setSessionTime] = useState<SessionTimeData | null>(null);
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
    const fetchSessionTime = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[SessionTimeWidget] Widget execution disabled by context");
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
          `/api/traffic/session-time?${params.toString()}`,
          { maxRetries: 3 }
        );
        
        // Handle null response (all retries failed or request was cancelled)
        if (!response) {
          return;
        }
        const data = await response.json();
        setSessionTime(data);
      } catch (error) {
        // Only log non-abort errors
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error("Error fetching session time:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionTime();
  }, [shouldExecuteWidgets, segmentId, startDate, endDate, currentSite, user, fetchWithController]);

  const formattedValue = sessionTime ? formatSessionTime(sessionTime.actual) : "0s";
  const changeText = `${sessionTime?.percentChange || 0}% from ${formatPeriodType(sessionTime?.periodType || "monthly")}`;
  const isPositiveChange = (sessionTime?.percentChange || 0) > 0;

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <BaseKpiWidget
      title="Average Session Time"
      tooltipText="Average time visitors spend on your site"
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