"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface ROIWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function ROIWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: ROIWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [roiValue, setRoiValue] = useState<number>(0);
  const [percentChange, setPercentChange] = useState<number>(0);
  const [periodType, setPeriodType] = useState<string>("monthly");
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  useEffect(() => {
    if (!currentSite?.id) return;
    
    const fetchROI = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('siteId', currentSite.id);
        if (user?.id) queryParams.append('userId', user.id);
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', endDate.toISOString());
        
        if (segmentId && segmentId !== "all") {
          queryParams.append('segmentId', segmentId);
          console.log(`[ROI Widget] Applying segment filter: ${segmentId}`);
        }

        const response = await fetch(`/api/roi?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch ROI data');
        }
        
        const data = await response.json();
        setRoiValue(data.actual !== undefined && data.actual !== null ? data.actual : 0);
        setPercentChange(data.percentChange !== undefined && data.percentChange !== null ? data.percentChange : 0);
        setPeriodType(data.periodType || "monthly");
        
        console.log(`[ROI Widget] Received ROI value: ${data.actual}%, type: ${typeof data.actual}, segment: ${segmentId || 'all'}`);
      } catch (error) {
        console.error('Error fetching ROI:', error);
        setRoiValue(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchROI();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId]);

  // Format the ROI value as percentage
  const formatPercentage = (value: number) => {
    return `${value}%`;
  };

  const formatPeriodType = (periodType: string) => {
    switch (periodType) {
      case "daily": return "previous day";
      case "weekly": return "previous week";
      case "monthly": return "previous month";
      case "quarterly": return "previous quarter";
      case "yearly": return "previous year";
      default: return "previous period";
    }
  };

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = formatPercentage(roiValue);
  const changeText = percentChange !== 0 
    ? `${percentChange}% from ${formatPeriodType(periodType)}`
    : "No change";
  const isPositiveChange = percentChange > 0 ? true : percentChange < 0 ? false : undefined;
  
  return (
    <BaseKpiWidget
      title="Return on Investment"
      tooltipText={`Leads converted per campaign budget${segmentId && segmentId !== "all" ? " for this segment" : ""}`}
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