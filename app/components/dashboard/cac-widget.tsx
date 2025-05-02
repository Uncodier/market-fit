"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface CACWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface CACData {
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
  // Special case for CAC = -1 (infinite/too high)
  if (value === -1) {
    return "∞";
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function CACWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: CACWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [cac, setCac] = useState<CACData | null>(null);
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
    const fetchCac = async () => {
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
        
        const response = await fetch(`/api/cac?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch CAC data');
        }
        const data = await response.json();
        setCac(data);
      } catch (error) {
        console.error("Error fetching CAC:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCac();
  }, [segmentId, startDate, endDate, currentSite, user]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = cac ? formatCurrency(cac.actual) : "$0";
  const changeText = cac && cac.actual === -1
    ? "No conversions"
    : `${cac?.percentChange || 0}% from ${formatPeriodType(cac?.periodType || "monthly")}`;
  const isPositiveChange = (cac?.percentChange || 0) < 0; // Note: For CAC, a decrease is positive
  
  return (
    <BaseKpiWidget
      title="CAC"
      tooltipText="Customer Acquisition Cost"
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