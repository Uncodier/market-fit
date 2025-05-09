"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { format, subDays } from "date-fns";

interface TotalCostsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface CostData {
  totalCosts: {
    actual: number;
    previous: number;
    percentChange: number;
    formattedActual: string;
    formattedPrevious: string;
  };
  periodType: string;
  noData?: boolean;
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

export function TotalCostsWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: TotalCostsWidgetProps) {
  const { currentSite } = useSite();
  const [costData, setCostData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(true);
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
    const fetchCostData = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/costs?siteId=${currentSite.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch cost data');
        }
        const data = await response.json();
        setCostData(data);
        setHasData(!data.noData);
      } catch (error) {
        console.error("Error fetching total costs:", error);
        setHasData(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCostData();
  }, [startDate, endDate, currentSite]);

  const formattedValue = costData && hasData
    ? `$${costData.totalCosts.formattedActual}` 
    : "$0";
    
  const changeText = costData && hasData
    ? `${costData.totalCosts.percentChange.toFixed(1)}% from ${formatPeriodType(costData.periodType)}` 
    : "No data available";
    
  const isPositiveChange = costData && hasData ? costData.totalCosts.percentChange < 0 : undefined;
  
  return (
    <BaseKpiWidget
      title="Total Costs"
      tooltipText="Sum of all costs across all categories"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      startDate={startDate}
      endDate={endDate}
    />
  );
} 