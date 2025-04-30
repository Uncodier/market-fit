"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface CACWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function CACWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: CACWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cacValue, setCacValue] = useState<number>(0);
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
    
    const fetchCAC = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('siteId', currentSite.id);
        if (user?.id) queryParams.append('userId', user.id);
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', endDate.toISOString());
        
        if (segmentId && segmentId !== "all") {
          queryParams.append('segmentId', segmentId);
          console.log(`[CAC Widget] Applying segment filter: ${segmentId}`);
        }

        const response = await fetch(`/api/cac?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch CAC data');
        }
        
        const data = await response.json();
        setCacValue(data.actual !== undefined && data.actual !== null ? data.actual : 0);
        setPercentChange(data.percentChange !== undefined && data.percentChange !== null ? data.percentChange : 0);
        setPeriodType(data.periodType || "monthly");
        
        console.log(`[CAC Widget] Received CAC value: $${data.actual}, type: ${typeof data.actual}, segment: ${segmentId || 'all'}`);
      } catch (error) {
        console.error('Error fetching CAC:', error);
        setCacValue(380); // Default fallback
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCAC();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId]);

  // Format the CAC value as currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
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

  const formattedValue = formatCurrency(cacValue);
  const changeText = percentChange !== 0 
    ? `${percentChange}% from ${formatPeriodType(periodType)}`
    : "No change";
    
  // For CAC, lower is better, so invert the positive/negative sentiment
  const isPositiveChange = percentChange > 0 ? false : percentChange < 0 ? true : undefined;
  
  return (
    <BaseKpiWidget
      title="CAC (Customer Acquisition Cost)"
      tooltipText={`Average cost of acquiring a customer${segmentId && segmentId !== "all" ? " for this segment" : ""}`}
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