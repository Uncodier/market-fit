"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface ROIWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface ROIData {
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

export function ROIWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: ROIWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [roi, setRoi] = useState<ROIData | null>(null);
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
    const fetchRoi = async () => {
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
        
        const response = await fetch(`/api/roi?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch ROI data');
        }
        const data = await response.json();
        setRoi(data);
      } catch (error) {
        console.error("Error fetching ROI:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoi();
  }, [segmentId, startDate, endDate, currentSite, user]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = roi ? `${roi.actual}%` : "0%";
  const changeText = `${roi?.percentChange || 0}% from ${formatPeriodType(roi?.periodType || "monthly")}`;
  const isPositiveChange = (roi?.percentChange || 0) > 0;
  
  return (
    <BaseKpiWidget
      title="ROI"
      tooltipText="Return on Investment"
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