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

export function LTVWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: LTVWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ltvValue, setLtvValue] = useState<number>(0);
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
    
    const fetchLTV = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('siteId', currentSite.id);
        if (user?.id) queryParams.append('userId', user.id);
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', endDate.toISOString());
        
        if (segmentId && segmentId !== "all") {
          queryParams.append('segmentId', segmentId);
          console.log(`[LTV Widget] Applying segment filter: ${segmentId}`);
        }

        const response = await fetch(`/api/ltv?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch LTV data');
        }
        
        const data = await response.json();
        setLtvValue(data.actual !== undefined && data.actual !== null ? data.actual : 0);
        setPercentChange(data.percentChange !== undefined && data.percentChange !== null ? data.percentChange : 0);
        setPeriodType(data.periodType || "monthly");
        
        console.log(`[LTV Widget] Received LTV value: ${data.actual}, type: ${typeof data.actual}, segment: ${segmentId || 'all'}`);
      } catch (error) {
        console.error('Error fetching LTV:', error);
        setLtvValue(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLTV();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Format the LTV value as currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Generate period type display text
  const getPeriodText = (periodType: string): string => {
    return periodType === "daily" ? "day" : 
           periodType === "weekly" ? "week" : 
           periodType === "monthly" ? "month" : 
           periodType === "quarterly" ? "quarter" : "year";
  };

  const formattedValue = formatCurrency(ltvValue);
  const changeText = percentChange !== 0 
    ? `${percentChange}% from last ${getPeriodText(periodType)}`
    : "No change";
  const isPositiveChange = percentChange > 0 ? true : percentChange < 0 ? false : undefined;
  
  return (
    <BaseKpiWidget
      title="LTV (Lifetime Value)"
      tooltipText={`Average value a customer generates during their lifecycle${segmentId && segmentId !== "all" ? " for this segment" : ""}`}
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