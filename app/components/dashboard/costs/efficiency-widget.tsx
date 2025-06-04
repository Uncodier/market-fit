"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { subDays } from "date-fns";

interface EfficiencyWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface CostData {
  totalCosts: {
    actual: number;
    previous: number;
    percentChange: number;
  };
  periodType: string;
  noData?: boolean;
}

interface RevenueData {
  totalSales: {
    actual: number;
    previous: number;
    percentChange: number;
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

export function EfficiencyWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: EfficiencyWidgetProps) {
  const { currentSite } = useSite();
  const { shouldExecuteWidgets } = useWidgetContext();
  const [costData, setCostData] = useState<CostData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [efficiency, setEfficiency] = useState({
    ratio: 0,
    prevRatio: 0,
    percentChange: 0
  });
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
    const fetchData = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[EfficiencyWidget] Widget execution disabled by context");
        return;
      }

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

        // Check if either API returned noData flag
        const noDataAvailable = costDataResult.noData || revenueDataResult.noData;
        setHasData(!noDataAvailable);

        // Only calculate if we have actual data
        if (!noDataAvailable) {
          // Get the current revenue and costs
          const currentRevenue = revenueDataResult.totalSales?.actual || 0;
          const currentCost = costDataResult.totalCosts?.actual || 0;
          
          // Get the previous revenue and costs
          const prevRevenue = revenueDataResult.totalSales?.previous || 0;
          const prevCost = costDataResult.totalCosts?.previous || 0;
          
          // Calculate efficiency ratio (Revenue / Cost)
          const currentRatio = currentCost > 0 ? currentRevenue / currentCost : 0;
          const prevRatio = prevCost > 0 ? prevRevenue / prevCost : 0;
          
          // Calculate percent change in ratio
          const percentChangeRatio = prevRatio > 0 
            ? ((currentRatio - prevRatio) / prevRatio) * 100 
            : 0;

          setEfficiency({
            ratio: currentRatio,
            prevRatio: prevRatio,
            percentChange: percentChangeRatio
          });
        } else {
          // Reset to zeros if no data
          setEfficiency({
            ratio: 0,
            prevRatio: 0,
            percentChange: 0
          });
        }
      } catch (error) {
        console.error("Error fetching efficiency data:", error);
        // Set default values in case of error
        setEfficiency({
          ratio: 0,
          prevRatio: 0,
          percentChange: 0
        });
        setHasData(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [shouldExecuteWidgets, startDate, endDate, currentSite]);

  // Format the efficiency ratio as a readable value
  const formatEfficiency = (ratio: number): string => {
    if (isNaN(ratio) || ratio === 0) return "0:1";
    return `${ratio.toFixed(1)}:1`;
  };

  const formattedValue = formatEfficiency(efficiency.ratio);
  const changeText = hasData
    ? `${!isNaN(efficiency.percentChange) ? efficiency.percentChange.toFixed(1) : "0"}% from ${formatPeriodType(costData?.periodType || "monthly")}`
    : "No data available";
  const isPositiveChange = !isNaN(efficiency.percentChange) && efficiency.percentChange > 0;
  
  return (
    <BaseKpiWidget
      title="Efficiency Ratio"
      tooltipText="Revenue to cost ratio (higher is better)"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={hasData ? isPositiveChange : undefined}
      isLoading={isLoading}
      startDate={startDate}
      endDate={endDate}
    />
  );
} 