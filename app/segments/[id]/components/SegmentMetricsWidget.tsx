"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { subDays } from "date-fns";


interface SegmentMetricsWidgetProps {
  segmentId: string;
  startDate?: Date;
  endDate?: Date;
}

interface SegmentMetrics {
  visitors: {
    current: number;
    previous: number;
    percentChange: number;
  };
  clicks: {
    current: number;
    previous: number;
    percentChange: number;
  };
  conversions: {
    current: number;
    previous: number;
    percentChange: number;
  };
  ctr: {
    current: number;
    previous: number;
    percentChange: number;
  };
  periodType: string;
}

// Helper function to format period type
function formatPeriodType(periodType: string): string {
  switch (periodType) {
    case "daily": return "previous day";
    case "weekly": return "previous week";
    case "monthly": return "previous month";
    case "quarterly": return "previous quarter";
    case "yearly": return "previous year";
    default: return "previous period";
  }
}

export function SegmentMetricsWidget({ 
  segmentId,
  startDate: propStartDate,
  endDate: propEndDate
}: SegmentMetricsWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<SegmentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default date range
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
    const fetchMetrics = async () => {
      if (!currentSite || currentSite.id === "default" || !segmentId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        params.append("segmentId", segmentId);
        params.append("startDate", startDate.toISOString());
        params.append("endDate", endDate.toISOString());
        if (user?.id) {
          params.append("userId", user.id);
        }
        
        console.log(`[SegmentMetricsWidget] Fetching metrics with params:`, Object.fromEntries(params.entries()));
        
        const response = await fetch(`/api/segment-metrics?${params.toString()}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[SegmentMetricsWidget] API error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[SegmentMetricsWidget] Received metrics:`, data);
        
        setMetrics(data);
      } catch (err) {
        console.error("Error fetching segment metrics:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [segmentId, startDate, endDate, currentSite, user]);

  if (!currentSite || currentSite.id === "default") {
    return null;
  }

  // If there's an error, show zeros with appropriate status
  const displayMetrics = error ? {
    visitors: { current: 0, previous: 0, percentChange: 0 },
    clicks: { current: 0, previous: 0, percentChange: 0 },
    conversions: { current: 0, previous: 0, percentChange: 0 },
    ctr: { current: 0, previous: 0, percentChange: 0 },
    periodType: "monthly"
  } : metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Visitors Widget */}
      <BaseKpiWidget
        title="Visitors"
        tooltipText="Number of unique visitors for this segment"
        value={displayMetrics?.visitors.current.toLocaleString() || "0"}
        changeText={error 
          ? "Error loading data" 
          : `${displayMetrics?.visitors.percentChange || 0}% from ${formatPeriodType(displayMetrics?.periodType || "monthly")}`
        }
        isPositiveChange={(displayMetrics?.visitors.percentChange || 0) > 0}
        isLoading={isLoading}
        customStatus={error ? (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        ) : undefined}
      />

      {/* Clicks Widget */}
      <BaseKpiWidget
        title="Clicks"
        tooltipText="Number of click events for this segment"
        value={displayMetrics?.clicks.current.toLocaleString() || "0"}
        changeText={error 
          ? "Error loading data" 
          : `${displayMetrics?.clicks.percentChange || 0}% from ${formatPeriodType(displayMetrics?.periodType || "monthly")}`
        }
        isPositiveChange={(displayMetrics?.clicks.percentChange || 0) > 0}
        isLoading={isLoading}
        customStatus={error ? (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        ) : undefined}
      />

      {/* Conversions Widget */}
      <BaseKpiWidget
        title="Conversions"
        tooltipText="Number of leads converted for this segment"
        value={displayMetrics?.conversions.current.toLocaleString() || "0"}
        changeText={error 
          ? "Error loading data" 
          : `${displayMetrics?.conversions.percentChange || 0}% from ${formatPeriodType(displayMetrics?.periodType || "monthly")}`
        }
        isPositiveChange={(displayMetrics?.conversions.percentChange || 0) > 0}
        isLoading={isLoading}
        customStatus={error ? (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        ) : undefined}
      />

      {/* CTR Widget */}
      <BaseKpiWidget
        title="CTR"
        tooltipText="Click-through rate (conversions / visitors)"
        value={`${displayMetrics?.ctr.current || 0}%`}
        changeText={error 
          ? "Error loading data" 
          : `${displayMetrics?.ctr.percentChange || 0}% from ${formatPeriodType(displayMetrics?.periodType || "monthly")}`
        }
        isPositiveChange={(displayMetrics?.ctr.percentChange || 0) > 0}
        isLoading={isLoading}
        customStatus={error ? (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        ) : undefined}
      />
    </div>
  );
} 