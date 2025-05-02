"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";

interface OverheadWidgetProps {
  startDate: Date;
  endDate: Date;
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

export function OverheadWidget({ 
  startDate,
  endDate
}: OverheadWidgetProps) {
  const { currentSite } = useSite();
  const [costData, setCostData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [overhead, setOverhead] = useState({
    amount: 0,
    prevAmount: 0, 
    percentChange: 0
  });
  const [hasData, setHasData] = useState(true);

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

        // Process data only if we have valid data
        if (!data.noData) {
          // Calculate overhead costs (Administration + Operations)
          const adminCategory = data.costCategories.find(
            (category: any) => category.name === "Administration"
          );
          
          const operationsCategory = data.costCategories.find(
            (category: any) => category.name === "Operations"
          );
          
          const currentOverhead = 
            (adminCategory ? adminCategory.amount : 0) + 
            (operationsCategory ? operationsCategory.amount : 0);
            
          const prevOverhead = 
            (adminCategory ? adminCategory.prevAmount : 0) + 
            (operationsCategory ? operationsCategory.prevAmount : 0);
            
          const percentChange = prevOverhead > 0 
            ? ((currentOverhead - prevOverhead) / prevOverhead) * 100 
            : 0;
          
          setOverhead({
            amount: currentOverhead,
            prevAmount: prevOverhead,
            percentChange: percentChange
          });
        } else {
          // Reset to zeros if no data
          setOverhead({
            amount: 0,
            prevAmount: 0,
            percentChange: 0
          });
        }
      } catch (error) {
        console.error("Error fetching overhead costs:", error);
        setHasData(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCostData();
  }, [startDate, endDate, currentSite]);

  const formattedValue = formatCurrency(overhead.amount);
  const changeText = hasData 
    ? `${overhead.percentChange.toFixed(1)}% from ${formatPeriodType(costData?.periodType || "monthly")}`
    : "No data available";
  const isPositiveChange = overhead.percentChange < 0;
  
  return (
    <BaseKpiWidget
      title="Overhead Costs"
      tooltipText="Administrative and operational expenses"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={hasData ? isPositiveChange : undefined}
      isLoading={isLoading}
      startDate={startDate}
      endDate={endDate}
    />
  );
} 