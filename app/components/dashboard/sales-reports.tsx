"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart, BarChart } from "@/app/components/ui/icons"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { SalesDistributionChart } from "@/app/components/dashboard/sales-distribution-chart"
import { MonthlySalesEvolutionChart } from "@/app/components/dashboard/monthly-sales-evolution-chart"
import { SalesBreakdownReport } from "@/app/components/dashboard/sales-breakdown-report"
import { useRequestController } from "@/app/hooks/useRequestController"
import { startOfMonth, format } from "date-fns"

interface SalesData {
  totalSales: {
    actual: number;
    previous: number;
    percentChange: number;
    formattedActual: string;
    formattedPrevious: string;
  };
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
  averageOrderValue: {
    actual: number;
    previous: number;
    percentChange: number;
  };
  salesCategories: Array<{
    name: string;
    amount: number;
    prevAmount: number;
    percentChange: number;
  }>;
  monthlyData: Array<{
    month: string;
    onlineSales: number;
    retailSales: number;
  }>;
  salesDistribution: Array<{
    category: string;
    percentage: number;
    amount: number;
  }>;
  periodType: string;
  noData?: boolean;
  isDemoData?: boolean;
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
function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

// Default start and end dates for fallback
const defaultStartDate = startOfMonth(new Date());
const defaultEndDate = new Date();

interface SalesReportsProps {
  startDate?: Date;
  endDate?: Date;
  segmentId?: string;
}

export function SalesReports({ 
  startDate: propStartDate, 
  endDate: propEndDate,
  segmentId = "all" 
}: SalesReportsProps) {
  const { currentSite } = useSite();
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const { fetchWithController, cancelAllRequests } = useRequestController();
  
  // Use provided props or fallback to defaults
  const startDate = propStartDate || defaultStartDate;
  const endDate = propEndDate || defaultEndDate;
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchSalesData = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      if (isMounted) {
        setIsLoading(true);
        setDataReady(false);
      }
      
      try {
        console.log(`[SalesReports] Fetching sales data with: startDate=${format(startDate, "yyyy-MM-dd")}, endDate=${format(endDate, "yyyy-MM-dd")}, segmentId=${segmentId}`);
        
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        params.append("startDate", format(startDate, "yyyy-MM-dd"));
        params.append("endDate", format(endDate, "yyyy-MM-dd"));
        if (segmentId !== "all") {
          params.append("segmentId", segmentId);
        }
        
        const response = await fetchWithController(`/api/revenue?${params.toString()}`);
        // Check if request was aborted or component unmounted
        if (response === null || !isMounted) {
          console.log("[SalesReports] Request was cancelled or component unmounted");
          return; // Exit early, don't update state for cancelled requests
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch sales data');
        }
        
        const data = await response.json();
        console.log("[SalesReports] Data received:", data);
        
        if (isMounted) {
          setSalesData(data);
          setDataReady(true);
        }
      } catch (error) {
        // Ignore AbortError as it's handled in the fetchWithController
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log("[SalesReports] Request was aborted");
          return;
        }
        
        console.error("Error fetching sales data:", error);
        // Use default data structure when API fails
        if (isMounted) {
          setSalesData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSalesData();
    
    // Cleanup function
    return () => {
      isMounted = false;
      cancelAllRequests();
    };
  }, [
    startDate, 
    endDate, 
    currentSite?.id, // Only depend on site ID, not the entire object
    segmentId
    // Note: fetchWithController and cancelAllRequests are stable now with useCallback
  ]);
  
  // Check if categories data is empty
  const hasCategoriesData = salesData?.salesCategories && salesData.salesCategories.length > 0;

  // Format values for KPI widgets
  const formatTotalSales = salesData?.totalSales?.formattedActual || "0";
  const totalSalesChange = salesData?.totalSales?.percentChange || 0;
  const totalSalesChangeText = `${totalSalesChange.toFixed(1)}% from ${formatPeriodType(salesData?.periodType || 'previous period')}`;
  
  // Online sales from channelSales
  const onlineSalesAmount = salesData?.channelSales?.online?.amount || 0;
  const onlineSalesChange = salesData?.channelSales?.online?.percentChange || 0;
  const onlineSalesChangeText = `${onlineSalesChange.toFixed(1)}% from ${formatPeriodType(salesData?.periodType || 'previous period')}`;
  
  // Retail sales from channelSales
  const retailSalesAmount = salesData?.channelSales?.retail?.amount || 0;
  const retailSalesChange = salesData?.channelSales?.retail?.percentChange || 0;
  const retailSalesChangeText = `${retailSalesChange.toFixed(1)}% from ${formatPeriodType(salesData?.periodType || 'previous period')}`;
  
  // Average order value
  const aovValue = salesData?.averageOrderValue?.actual || 0;
  const aovChange = salesData?.averageOrderValue?.percentChange || 0;
  const aovChangeText = `${aovChange.toFixed(1)}% from ${formatPeriodType(salesData?.periodType || 'previous period')}`;

  return (
    <div className="space-y-6">
      {/* KPI Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BaseKpiWidget
          title="Total Sales"
          tooltipText="Sum of all sales revenue across all channels"
          value={`$${formatTotalSales}`}
          changeText={totalSalesChangeText}
          isPositiveChange={totalSalesChange > 0}
          isLoading={isLoading}
        />
        <BaseKpiWidget
          title="Online Sales"
          tooltipText="Revenue from online transactions and digital channels"
          value={`$${formatCurrency(onlineSalesAmount)}`}
          changeText={onlineSalesChangeText}
          isPositiveChange={onlineSalesChange > 0}
          isLoading={isLoading}
        />
        <BaseKpiWidget
          title="Retail Sales"
          tooltipText="Revenue from in-store and physical retail channels"
          value={`$${formatCurrency(retailSalesAmount)}`}
          changeText={retailSalesChangeText}
          isPositiveChange={retailSalesChange > 0}
          isLoading={isLoading}
        />
        <BaseKpiWidget
          title="Average Order Value"
          tooltipText="Average amount spent per order or transaction"
          value={`$${formatCurrency(aovValue)}`}
          changeText={aovChangeText}
          isPositiveChange={aovChange > 0}
          isLoading={isLoading}
        />
      </div>
      
      {/* Charts Section - Pie and Bar side by side */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <SalesDistributionChart 
          data={salesData?.salesDistribution || []}
          isLoading={isLoading}
          dataReady={dataReady}
        />
        <MonthlySalesEvolutionChart
          data={salesData?.monthlyData || []}
          isLoading={isLoading}
          dataReady={dataReady}
        />
      </div>
      
      {/* Sales Breakdown Report Section */}
      <SalesBreakdownReport
        data={salesData?.salesCategories || []}
        isLoading={isLoading}
        dataReady={dataReady}
      />
    </div>
  );
} 