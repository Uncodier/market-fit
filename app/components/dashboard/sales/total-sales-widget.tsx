"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { format, subDays } from "date-fns";

interface TotalSalesWidgetProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange?: (start: Date, end: Date) => void;
}

interface SalesData {
  totalSales: {
    actual: number;
    previous: number;
    percentChange: number;
    formattedActual: string;
    formattedPrevious: string;
  };
  periodType: string;
}

// Format period type for display
function formatPeriodType(periodType: string): string {
  switch (periodType) {
    case "daily": return "yesterday";
    case "weekly": return "last week";
    case "monthly": return "last month";
    case "quarterly": return "last quarter";
    case "yearly": return "last year";
    default: return "previous period";
  }
}

export function TotalSalesWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: TotalSalesWidgetProps) {
  const { currentSite } = useSite();
  const { shouldExecuteWidgets } = useWidgetContext();
  const [salesData, setSalesData] = useState<SalesData | null>(null);
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
    const fetchSalesData = async () => {
      // Global widget protection
      if (!shouldExecuteWidgets) {
        console.log("[TotalSalesWidget] Widget execution disabled by context");
        return;
      }

      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/revenue?siteId=${currentSite.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch sales data');
        }
        const data = await response.json();
        setSalesData(data);
      } catch (error) {
        console.error("Error fetching total sales:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesData();
  }, [shouldExecuteWidgets, startDate, endDate, currentSite]);

  const formattedValue = salesData 
    ? `$${salesData.totalSales.formattedActual}` 
    : "$0";
    
  const changeValue = salesData?.totalSales?.percentChange || 0;
  const safeChangeValue = isNaN(changeValue) ? 0 : changeValue;
  const changeText = salesData 
    ? `${safeChangeValue.toFixed(1)}% from ${formatPeriodType(salesData.periodType)}` 
    : "0% from previous period";
    
  const isPositiveChange = safeChangeValue > 0;
  
  return (
    <BaseKpiWidget
      title="Total Sales"
      tooltipText="Sum of all sales revenue across all channels"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      startDate={startDate}
      endDate={endDate}
    />
  );
} 