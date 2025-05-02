"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface ActiveExperimentsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface ActiveExperimentsData {
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

export function ActiveExperimentsWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: ActiveExperimentsWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [activeExperiments, setActiveExperiments] = useState<ActiveExperimentsData | null>(null);
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
    const fetchActiveExperiments = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
        const end = endDate ? format(endDate, "yyyy-MM-dd") : null;
        
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        
        const response = await fetch(`/api/active-experiments?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch active experiments data');
        }
        const data = await response.json();
        setActiveExperiments(data);
      } catch (error) {
        console.error("Error fetching active experiments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveExperiments();
  }, [startDate, endDate, currentSite, user]);

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = activeExperiments ? activeExperiments.actual.toString() : "0";
  const changeText = `${activeExperiments?.percentChange || 0}% from ${formatPeriodType(activeExperiments?.periodType || "monthly")}`;
  const isPositiveChange = (activeExperiments?.percentChange || 0) > 0;
  
  return (
    <BaseKpiWidget
      title="Active Experiments"
      tooltipText="Experiments running in the selected time period"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
    />
  );
} 