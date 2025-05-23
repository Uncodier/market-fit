"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface LTVWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface LTVData {
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

// Format currency for display
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function LTVWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: LTVWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [ltv, setLtv] = useState<LTVData | null>(null);
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
    const fetchLtv = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        // Validate dates - don't allow future dates
        const now = new Date();
        const validStartDate = startDate > now ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) : startDate;
        const validEndDate = endDate > now ? now : endDate;
        
        const start = validStartDate ? format(validStartDate, "yyyy-MM-dd") : null;
        const end = validEndDate ? format(validEndDate, "yyyy-MM-dd") : null;
        
        const params = new URLSearchParams();
        params.append("segmentId", segmentId);
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        
        console.log("[LTVWidget] Requesting data with params:", Object.fromEntries(params.entries()));
        
        const response = await fetch(`/api/ltv?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch LTV data');
        }
        const data = await response.json();
        setLtv(data);
      } catch (error) {
        console.error("Error fetching LTV:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLtv();
  }, [segmentId, startDate, endDate, currentSite, user]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = ltv ? formatCurrency(ltv.actual) : "$0";
  const changeText = `${ltv?.percentChange || 0}% from ${formatPeriodType(ltv?.periodType || "monthly")}`;
  const isPositiveChange = (ltv?.percentChange || 0) > 0;
  
  return (
    <BaseKpiWidget
      title="Lifetime Value"
      tooltipText="Average customer lifetime value"
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