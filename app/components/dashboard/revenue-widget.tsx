"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useRequestController } from "@/app/hooks/useRequestController";

interface RevenueWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface RevenueData {
  totalSales: {
    actual: number;
    previous: number;
    percentChange: number;
    formattedActual: string;
    formattedPrevious: string;
  };
  periodType: string;
  noData?: boolean;
  isDemoData?: boolean;
}

// Format currency
const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
};

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

export function RevenueWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: RevenueWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());
  const [hasNoData, setHasNoData] = useState(false);
  const [isDemoData, setIsDemoData] = useState(false);
  const { fetchWithController, cancelAllRequests } = useRequestController();

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
    let isMounted = true;
    
    const fetchRevenue = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      if (isMounted) {
        setIsLoading(true);
        setHasNoData(false);
        setIsDemoData(false);
      }
      
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
        
        console.log("[RevenueWidget] Fetching revenue data with params:", Object.fromEntries(params.entries()));
        
        const response = await fetchWithController(`/api/revenue?${params.toString()}`);
        // Check if request was aborted or component unmounted
        if (response === null || !isMounted) {
          console.log("[RevenueWidget] Request was cancelled or component unmounted");
          return; // Exit early, don't update state for cancelled requests
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch revenue data');
        }
        const data = await response.json();
        
        if (isMounted) {
          setRevenue(data);
          setHasNoData(!!data.noData);
          setIsDemoData(!!data.isDemoData);
        }
      } catch (error) {
        // Ignore AbortError as it's handled in the fetchWithController
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log("[RevenueWidget] Request was aborted");
          return;
        }
        
        console.error("Error fetching revenue:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRevenue();
    
    // Cleanup function
    return () => {
      isMounted = false;
      cancelAllRequests();
    };
  }, [
    segmentId, 
    startDate, 
    endDate, 
    currentSite?.id, // Only depend on site ID, not the entire object
    user?.id // Only depend on user ID, not the entire object
    // Note: fetchWithController and cancelAllRequests are stable now with useCallback
  ]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    // Cancel any in-flight requests before changing dates
    cancelAllRequests();
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = revenue ? `$${revenue.totalSales.formattedActual}` : "$0";
  
  const changeValue = revenue?.totalSales?.percentChange || 0;
  const safeChangeValue = isNaN(changeValue) ? 0 : changeValue;
  const changeText = hasNoData 
    ? "No change"
    : `${safeChangeValue.toFixed(1)}% from ${formatPeriodType(revenue?.periodType || "monthly")}`;
  const isPositiveChange = safeChangeValue > 0;
  
  return (
    <BaseKpiWidget
      title="Total Revenue"
      tooltipText={`Total revenue across ${segmentId === "all" ? "all segments" : "selected segment"}`}
      value={formattedValue}
      changeText={isDemoData ? `${changeText} (Demo data)` : changeText}
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