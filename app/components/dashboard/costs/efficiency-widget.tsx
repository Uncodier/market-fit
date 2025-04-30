"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "../base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";

interface EfficiencyWidgetProps {
  startDate: Date;
  endDate: Date;
}

interface CostData {
  totalCosts: {
    actual: number;
    previous: number;
    percentChange: number;
  };
  periodType: string;
}

interface RevenueData {
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

export function EfficiencyWidget({ 
  startDate,
  endDate
}: EfficiencyWidgetProps) {
  const { currentSite } = useSite();
  const [costData, setCostData] = useState<CostData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [efficiency, setEfficiency] = useState({
    ratio: 0,
    prevRatio: 0,
    percentChange: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        // Fetch costs
        const costResponse = await fetch(`/api/costs?siteId=${currentSite.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
        if (!costResponse.ok) {
          throw new Error('Failed to fetch cost data');
        }
        const costDataResult = await costResponse.json();
        setCostData(costDataResult);

        // Fetch revenue
        const revenueResponse = await fetch(`/api/revenue?siteId=${currentSite.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
        if (!revenueResponse.ok) {
          throw new Error('Failed to fetch revenue data');
        }
        const revenueDataResult = await revenueResponse.json();
        setRevenueData(revenueDataResult);

        // Calculate efficiency ratio (Revenue / Cost)
        const currentRatio = costDataResult.totalCosts.actual > 0 
          ? revenueDataResult.actual / costDataResult.totalCosts.actual 
          : 0;
        
        const prevRatio = costDataResult.totalCosts.previous > 0 
          ? (revenueDataResult.actual / (1 + revenueDataResult.percentChange / 100)) / costDataResult.totalCosts.previous 
          : 0;
          
        const percentChangeRatio = prevRatio > 0 
          ? ((currentRatio - prevRatio) / prevRatio) * 100 
          : 0;

        setEfficiency({
          ratio: currentRatio,
          prevRatio: prevRatio,
          percentChange: percentChangeRatio
        });
      } catch (error) {
        console.error("Error fetching efficiency data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, currentSite]);

  // Format the efficiency ratio as a readable value
  const formatEfficiency = (ratio: number): string => {
    if (ratio === 0) return "0:1";
    return `${ratio.toFixed(1)}:1`;
  };

  const formattedValue = formatEfficiency(efficiency.ratio);
  const changeText = `${efficiency.percentChange.toFixed(1)}% from ${formatPeriodType(costData?.periodType || "monthly")}`;
  const isPositiveChange = efficiency.percentChange > 0;
  
  return (
    <BaseKpiWidget
      title="Efficiency Ratio"
      tooltipText="Revenue to cost ratio (higher is better)"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      startDate={startDate}
      endDate={endDate}
    />
  );
} 