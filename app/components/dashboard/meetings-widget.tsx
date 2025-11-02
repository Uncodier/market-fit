"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useAuth } from "@/app/hooks/use-auth";
import { useSite } from "@/app/context/SiteContext";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";

interface MeetingsWidgetProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface MeetingsData {
  actual: number;
  percentChange: number;
  periodType: string;
}

export function MeetingsWidget({ 
  startDate, 
  endDate, 
  segmentId = "all" 
}: MeetingsWidgetProps) {
  const [data, setData] = useState<MeetingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { currentSite } = useSite();
  const { fetchWithController } = useRequestController();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite?.id || !user?.id) return;

      setIsLoading(true);

      const params = new URLSearchParams({
        siteId: currentSite.id,
        userId: user.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        segmentId: segmentId
      });

      const response = await fetchWithRetry(
        fetchWithController,
        `/api/performance/meetings?${params}`,
        { maxRetries: 3 }
      );

      if (!response) {
        // All retries failed or request was cancelled - show default 0 value
        setIsLoading(false);
        setData(null);
        return;
      }

      const result = await response.json();
      setData(result);
      setIsLoading(false);
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
  const changeText = `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title="Meetings"
      value={displayValue}
      changeText={changeText}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
    />
  );
}
