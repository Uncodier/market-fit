"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "../base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { format } from "date-fns";

interface TotalCostsWidgetProps {
  startDate: Date;
  endDate: Date;
  onDateChange?: (start: Date, end: Date) => void;
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
  startDate,
  endDate
}: TotalCostsWidgetProps) {
  const { currentSite } = useSite();
  const [costData, setCostData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } catch (error) {
        console.error("Error fetching total costs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCostData();
  }, [startDate, endDate, currentSite]);

  const formattedValue = costData 
    ? `$${costData.totalCosts.formattedActual}` 
    : "$0";
    
  const changeText = costData 
    ? `${costData.totalCosts.percentChange.toFixed(1)}% from ${formatPeriodType(costData.periodType)}` 
    : "0% from previous period";
    
  const isPositiveChange = costData ? costData.totalCosts.percentChange < 0 : false;
  
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