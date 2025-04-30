"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface ActiveExperimentsWidgetProps {
  startDate?: Date;
  endDate?: Date;
  segmentId?: string;
}

export function ActiveExperimentsWidget({ 
  startDate: propStartDate,
  endDate: propEndDate,
  segmentId = "all"
}: ActiveExperimentsWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [experimentsCount, setExperimentsCount] = useState<number>(0);
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
    
    const fetchActiveExperiments = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('siteId', currentSite.id);
        if (user?.id) queryParams.append('userId', user.id);
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', endDate.toISOString());
        
        // Asegurarse de que el segmentId se aplique correctamente
        if (segmentId && segmentId !== "all") {
          queryParams.append('segmentId', segmentId);
          console.log(`[ActiveExperimentsWidget] Applying segment filter: ${segmentId}`);
        }

        const response = await fetch(`/api/active-experiments?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch active experiments');
        }
        
        const data = await response.json();
        setExperimentsCount(data.actual !== undefined && data.actual !== null ? data.actual : 0);
        setPercentChange(data.percentChange !== undefined && data.percentChange !== null ? data.percentChange : 0);
        setPeriodType(data.periodType || "monthly");
        
        console.log(`[ActiveExperimentsWidget] Received count: ${data.actual}, segment: ${segmentId || 'all'}`);
      } catch (error) {
        console.error('Error fetching active experiments:', error);
        setExperimentsCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchActiveExperiments();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Format period type for display
  const formatPeriodType = (type: string): string => {
    switch (type) {
      case "daily": return "day";
      case "weekly": return "week";
      case "monthly": return "month";
      case "quarterly": return "quarter";
      case "yearly": return "year";
      default: return "period";
    }
  };

  // Custom status for special cases
  let customStatus = null;
  let formattedValue = experimentsCount.toString();
  let changeText = "";
  let isPositiveChange = undefined;

  if (percentChange === 0 && experimentsCount === 0) {
    customStatus = <p className="text-xs text-muted-foreground">No experiments running</p>;
  } else {
    changeText = `${percentChange}% from last ${formatPeriodType(periodType)}`;
    isPositiveChange = percentChange > 0;
  }
  
  return (
    <BaseKpiWidget
      title="Active Experiments"
      tooltipText={`Number of currently running experiments${segmentId && segmentId !== "all" ? " for this segment" : ""}`}
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      customStatus={customStatus}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
      segmentBadge={segmentId !== "all"}
    />
  );
} 