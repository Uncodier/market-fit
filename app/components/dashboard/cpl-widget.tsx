"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface CPLWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface CPLData {
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

export function CPLWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: CPLWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [cpl, setCpl] = useState<CPLData | null>(null);
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
    const fetchCpl = async () => {
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
        
        const response = await fetch(`/api/cpl?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch CPL data');
        }
        const data = await response.json();
        setCpl(data);
      } catch (error) {
        console.error("Error fetching CPL:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCpl();
  }, [segmentId, startDate, endDate, currentSite, user]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = cpl ? formatCurrency(cpl.actual) : "$0";
  const changeText = `${cpl?.percentChange || 0}% from ${formatPeriodType(cpl?.periodType || "monthly")}`;
  const isPositiveChange = (cpl?.percentChange || 0) < 0; // Note: For CPL, a decrease is positive
  
  return (
    <BaseKpiWidget
      title="CPL"
      tooltipText="Cost Per Lead"
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