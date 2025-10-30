"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useAuth } from "@/app/hooks/use-auth";
import { useSite } from "@/app/context/SiteContext";

interface LeadsContactedWidgetProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface LeadsContactedData {
  actual: number;
  percentChange: number;
  periodType: string;
}

export function LeadsContactedWidget({ 
  startDate, 
  endDate, 
  segmentId = "all" 
}: LeadsContactedWidgetProps) {
  const [data, setData] = useState<LeadsContactedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { currentSite } = useSite();
  const { fetchWithController } = useRequestController();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite?.id || !user?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          siteId: currentSite.id,
          userId: user.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          segmentId: segmentId
        });

        const response = await fetchWithController(
          `/api/performance/leads-contacted?${params}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching leads contacted data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSite?.id, user?.id, startDate, endDate, segmentId, fetchWithController]);

  const formatPeriodType = (periodType: string) => {
    switch (periodType) {
      case "daily": return "yesterday";
      case "weekly": return "last week";
      case "monthly": return "last month";
      default: return "previous period";
    }
  };

  const displayValue = data?.actual?.toLocaleString() || "0";
  const changeText = error 
    ? "Error loading data" 
    : `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title="Leads Contacted"
      value={displayValue}
      changeText={changeText}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
      customStatus={error ? (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      ) : undefined}
    />
  );
}
