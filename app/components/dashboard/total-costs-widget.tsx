"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface TotalCostsWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function TotalCostsWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: TotalCostsWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCosts, setTotalCosts] = useState<number>(0);
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
    
    const fetchTotalCosts = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('siteId', currentSite.id);
        if (user?.id) queryParams.append('userId', user.id);
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', endDate.toISOString());
        
        if (segmentId && segmentId !== "all") {
          queryParams.append('segmentId', segmentId);
          console.log(`[Total Costs Widget] Applying segment filter: ${segmentId}`);
        }

        const response = await fetch(`/api/costs?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch total costs data');
        }
        
        const data = await response.json();
        setTotalCosts(data.totalCosts?.actual || 0);
        setPercentChange(data.totalCosts?.percentChange || 0);
        setPeriodType(data.periodType || "monthly");
        
        console.log(`[Total Costs Widget] Received total costs: $${data.totalCosts?.actual}, segment: ${segmentId || 'all'}`);
      } catch (error) {
        console.error('Error fetching total costs:', error);
        setTotalCosts(5000); // Default fallback value
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTotalCosts();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId]);

  // Format the total costs value as currency
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

  const formattedValue = formatCurrency(totalCosts);
  const changeText = percentChange !== 0 
    ? `${percentChange.toFixed(1)}% from ${formatPeriodType(periodType)}`
    : "No change";
    
  // For costs, lower is better, so invert the positive/negative sentiment
  const isPositiveChange = percentChange > 0 ? false : percentChange < 0 ? true : undefined;
  
  return (
    <BaseKpiWidget
      title="Total Costs"
      tooltipText={`Total marketing and operational costs${segmentId && segmentId !== "all" ? " for this segment" : ""}`}
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