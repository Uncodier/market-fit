"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { subDays } from "date-fns";

interface OnlineSalesWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface SalesData {
  channelSales: {
    online: {
      amount: number;
      prevAmount: number;
      percentChange: number;
    };
    retail: {
      amount: number;
      prevAmount: number;
      percentChange: number;
    };
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

// Format currency
const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
};

export function OnlineSalesWidget({ 
  startDate: propStartDate,
  endDate: propEndDate
}: OnlineSalesWidgetProps) {
  const { currentSite } = useSite();
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
        console.error("Error fetching online sales:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesData();
  }, [startDate, endDate, currentSite]);

  // Set defaults if no data available
  const onlineSales = salesData?.channelSales?.online || {
    amount: 0,
    prevAmount: 0,
    percentChange: 0
  };

  const formattedValue = formatCurrency(onlineSales.amount || 0);
  const changeValue = onlineSales.percentChange || 0;
  const safeChangeValue = isNaN(changeValue) ? 0 : changeValue;
  const changeText = `${safeChangeValue.toFixed(1)}% from ${formatPeriodType(salesData?.periodType || "monthly")}`;
  const isPositiveChange = safeChangeValue > 0;
  
  return (
    <BaseKpiWidget
      title="Online Sales"
      tooltipText="Revenue from all online channels"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      startDate={startDate}
      endDate={endDate}
    />
  );
} 