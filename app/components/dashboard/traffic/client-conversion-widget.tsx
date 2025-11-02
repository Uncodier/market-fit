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

interface ClientConversionData {
  actual: number;
  percentChange: number;
  periodType: string;
}

interface ClientConversionWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function ClientConversionWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: ClientConversionWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
  const { fetchWithController } = useRequestController();
  const [conversionData, setConversionData] = useState<ClientConversionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use the exact same dates as other widgets for consistency
  const startDate = propStartDate || subDays(new Date(), 30);
  const endDate = propEndDate || new Date();

  useEffect(() => {
    const fetchClientConversion = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[ClientConversionWidget] Widget execution disabled by context");
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
        
        console.log("[ClientConversionWidget] Fetching conversion data with params:", params.toString());
        
        const response = await fetchWithRetry(
          fetchWithController,
          `/api/traffic/client-conversion?${params.toString()}`,
          { maxRetries: 3 }
        );
        
        // Handle null response (all retries failed or request was cancelled)
        if (!response) {
          return;
        }
        
        const data = await response.json();
        console.log("[ClientConversionWidget] Data received:", data);
        setConversionData(data);
        
      } catch (error) {
        // Only log non-abort errors
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error("Error fetching client conversion:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientConversion();
  }, [shouldExecuteWidgets, segmentId, startDate, endDate, currentSite, user, fetchWithController]);

  const formattedValue = conversionData ? `${conversionData.actual}%` : "0%";
  const changeText = `${conversionData?.percentChange || 0}% from ${formatPeriodType(conversionData?.periodType || "monthly")}`;
  const isPositiveChange = (conversionData?.percentChange || 0) > 0;

  return (
    <BaseKpiWidget
      title="Lead to Client"
      tooltipText="Percentage of leads that became clients (have at least one sale)"
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