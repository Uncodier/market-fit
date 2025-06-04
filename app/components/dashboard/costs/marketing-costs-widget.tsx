"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { format, subDays } from "date-fns";

interface MarketingCostsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface CostData {
  costCategories: Array<{
    name: string;
    amount: number;
    prevAmount: number;
    percentChange: number;
  }>;
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

// Format currency
const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
};

export function MarketingCostsWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: MarketingCostsWidgetProps) {
  const { currentSite } = useSite();
  const { shouldExecuteWidgets } = useWidgetContext();
  const [costData, setCostData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [marketingCost, setMarketingCost] = useState({
    amount: 0,
    prevAmount: 0, 
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
    const fetchCostData = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[MarketingCostsWidget] Widget execution disabled by context");
        return;
      }

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

        // Find marketing costs from the categories if we have data
        if (!data.noData) {
          const marketingCategory = data.costCategories.find(
            (category: any) => category.name === "Marketing"
          );
          
          if (marketingCategory) {
            setMarketingCost({
              amount: marketingCategory.amount,
              prevAmount: marketingCategory.prevAmount,
              percentChange: marketingCategory.percentChange
            });
          } else {
            // No marketing category found, set zeros
            setMarketingCost({
              amount: 0,
              prevAmount: 0,
              percentChange: 0
            });
          }
        } else {
          // No data available, set zeros
          setMarketingCost({
            amount: 0,
            prevAmount: 0,
            percentChange: 0
          });
        }
      } catch (error) {
        console.error("Error fetching marketing costs:", error);
        setHasData(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCostData();
  }, [shouldExecuteWidgets, startDate, endDate, currentSite]);

  const formattedValue = formatCurrency(marketingCost.amount);
  const changeText = hasData 
    ? `${marketingCost.percentChange.toFixed(1)}% from ${formatPeriodType(costData?.periodType || "monthly")}` 
    : "No data available";
  const isPositiveChange = marketingCost.percentChange < 0;
  
  return (
    <BaseKpiWidget
      title="Marketing Costs"
      tooltipText="Total expenditure on marketing activities"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={hasData ? isPositiveChange : undefined}
      isLoading={isLoading}
      startDate={startDate}
      endDate={endDate}
    />
  );
} 