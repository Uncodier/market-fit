"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useRequestController } from "@/app/hooks/useRequestController";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";

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

interface UniqueVisitorsData {
  actual: number;
  percentChange: number;
  periodType: string;
}

interface UniqueVisitorsWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function UniqueVisitorsWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: UniqueVisitorsWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const { fetchWithController } = useRequestController();
  const [uniqueVisitors, setUniqueVisitors] = useState<UniqueVisitorsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use the exact same dates as the chart for consistency
  const startDate = propStartDate || subDays(new Date(), 30);
  const endDate = propEndDate || new Date();

  useEffect(() => {
    const fetchUniqueVisitors = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[UniqueVisitorsWidget] Widget execution disabled by context");
        return;
      }

      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
        const end = endDate ? format(endDate, "yyyy-MM-dd") : null;
        
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        if (segmentId && segmentId !== "all") {
          params.append("segmentId", segmentId);
        }
        params.append("referrersLimit", "1"); // Minimal data needed
        
        console.log("[UniqueVisitorsWidget] Using combined endpoint for consistency");
        console.log("[UniqueVisitorsWidget] Query params:", params.toString());
        console.log("[UniqueVisitorsWidget] Date range:", { startDate, endDate, segmentId });
        
        // Use the SAME endpoint as the chart for 100% consistency
        const response = await fetchWithRetry(
          fetchWithController,
          `/api/traffic/session-events-combined?${params.toString()}`,
          { maxRetries: 3 }
        );
        
        // Handle null response (all retries failed or request was cancelled)
        if (!response) {
          return;
        }
        
        const data = await response.json();
        console.log("[UniqueVisitorsWidget] Current period data received:", data.totals);
        
        // Calculate previous period for comparison
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const periodLength = endDateObj.getTime() - startDateObj.getTime();
        const previousStart = new Date(startDateObj.getTime() - periodLength);
        const previousEnd = new Date(startDateObj.getTime());

        // Fetch previous period data using same endpoint
        const prevParams = new URLSearchParams();
        prevParams.append("siteId", currentSite.id);
        prevParams.append("startDate", format(previousStart, "yyyy-MM-dd"));
        prevParams.append("endDate", format(previousEnd, "yyyy-MM-dd"));
        if (segmentId && segmentId !== "all") {
          prevParams.append("segmentId", segmentId);
        }
        prevParams.append("referrersLimit", "1");
        
        const prevResponse = await fetchWithRetry(
          fetchWithController,
          `/api/traffic/session-events-combined?${prevParams.toString()}`,
          { maxRetries: 3 }
        );
        
        let previousUniqueVisitors = 0;
        if (prevResponse) {
          const prevData = await prevResponse.json();
          previousUniqueVisitors = prevData.totals?.uniqueVisitors || 0;
        }
        
        const currentUniqueVisitors = data.totals?.uniqueVisitors || 0;
        
        // Calculate percentage change
        const percentChange = previousUniqueVisitors > 0 
          ? ((currentUniqueVisitors - previousUniqueVisitors) / previousUniqueVisitors) * 100 
          : 0;

        setUniqueVisitors({
          actual: currentUniqueVisitors,
          percentChange: Math.round(percentChange * 10) / 10,
          periodType: "monthly"
        });
        
      } catch (error) {
        // Only log non-abort errors
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error("Error fetching unique visitors:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUniqueVisitors();
  }, [shouldExecuteWidgets, segmentId, startDate, endDate, currentSite, user, fetchWithController]);

  const formattedValue = uniqueVisitors ? uniqueVisitors.actual.toLocaleString() : "0";
  const changeText = `${uniqueVisitors?.percentChange || 0}% from ${formatPeriodType(uniqueVisitors?.periodType || "monthly")}`;
  const isPositiveChange = (uniqueVisitors?.percentChange || 0) > 0;

  return (
    <BaseKpiWidget
      title="Unique Visitors"
      tooltipText="Number of unique visitors who viewed pages on your site"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      showDatePicker={false}  // Always use parent dates for consistency
      startDate={startDate}
      endDate={endDate}
      onDateChange={() => {}} // No-op since we use parent dates
      segmentBadge={segmentId !== "all"}
    />
  );
} 