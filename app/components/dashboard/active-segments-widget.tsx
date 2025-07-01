"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useRequestController } from "@/app/hooks/useRequestController";

interface ActiveSegmentsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface ActiveSegmentsData {
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

export function ActiveSegmentsWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: ActiveSegmentsWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const { fetchWithController } = useRequestController();
  const [activeSegments, setActiveSegments] = useState<ActiveSegmentsData | null>(null);
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
    const fetchActiveSegments = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[ActiveSegmentsWidget] Widget execution disabled by context");
        return;
      }

      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      setHasError(false);
      
      try {
        const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
        const end = endDate ? format(endDate, "yyyy-MM-dd") : null;
        
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        
        const apiUrl = `/api/active-segments?${params.toString()}`;
        console.log("[ActiveSegmentsWidget] Requesting data with params:", Object.fromEntries(params.entries()));
        
        const response = await fetchWithController(apiUrl);
        
        // Handle null response (aborted request)
        if (response === null) {
          console.log("[ActiveSegmentsWidget] Request was aborted");
          return;
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log("[ActiveSegmentsWidget] Response:", data);
        
        if (data && typeof data.actual !== 'undefined') {
          setActiveSegments({
            actual: Number(data.actual),
            percentChange: Number(data.percentChange || 0),
            periodType: data.periodType || 'monthly'
          });
        } else {
          console.error("[ActiveSegmentsWidget] Invalid response format:", data);
          setHasError(true);
        }
      } catch (error) {
        // Only log non-abort errors
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error("[ActiveSegmentsWidget] Error:", error);
          setHasError(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveSegments();
  }, [shouldExecuteWidgets, startDate, endDate, currentSite, user, fetchWithController]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Custom status for error and special cases
  let customStatus = null;
  let formattedValue = null;
  let changeText = null;
  let isPositiveChange = undefined;

  if (hasError) {
    customStatus = <div className="text-sm text-red-500">Error loading segments data</div>;
  } else if (!currentSite || currentSite.id === "default") {
    formattedValue = "-";
    customStatus = <p className="text-xs text-muted-foreground">No site selected</p>;
  } else if (activeSegments && activeSegments.actual === 0) {
    formattedValue = "0";
    customStatus = <p className="text-xs text-muted-foreground">No active segments</p>;
  } else {
    formattedValue = activeSegments ? activeSegments.actual.toLocaleString() : "0";
    changeText = `${activeSegments?.percentChange || 0}% from ${formatPeriodType(activeSegments?.periodType || "monthly")}`;
    isPositiveChange = (activeSegments?.percentChange || 0) > 0;
  }

  return (
    <BaseKpiWidget
      title="Active Segments"
      tooltipText={`Number of active user segments for site: ${currentSite?.name || currentSite?.id}`}
      value={formattedValue}
      changeText={changeText || ""}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      customStatus={customStatus}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
    />
  );
} 