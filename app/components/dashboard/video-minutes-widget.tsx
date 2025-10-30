"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useAuth } from "@/app/hooks/use-auth";
import { useSite } from "@/app/context/SiteContext";

interface VideoMinutesWidgetProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface VideoMinutesData {
  actual: number;
  percentChange: number;
  periodType: string;
}

export function VideoMinutesWidget({ 
  startDate, 
  endDate, 
  segmentId = "all" 
}: VideoMinutesWidgetProps) {
  const [data, setData] = useState<VideoMinutesData | null>(null);
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
          `/api/performance/video-minutes?${params}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching video minutes data:", err);
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

  const displayValue = data?.actual ? `${data.actual} min` : "0 min";
  const changeText = error 
    ? "Error loading data" 
    : `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title="Video Minutes"
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
