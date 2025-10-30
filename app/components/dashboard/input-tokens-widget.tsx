"use client";

import { useState, useEffect } from "react";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useAuth } from "@/app/hooks/use-auth";
import { useSite } from "@/app/context/SiteContext";

interface InputTokensWidgetProps {
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

interface TokensData {
  actual: number;
  percentChange: number;
  periodType: string;
  breakdown: {
    commands: number;
    instanceLogs: number;
    inputTokens: number;
    outputTokens: number;
  };
}

export function InputTokensWidget({ 
  startDate, 
  endDate, 
  segmentId = "all" 
}: InputTokensWidgetProps) {
  const [data, setData] = useState<TokensData | null>(null);
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
          `/api/performance/tokens?${params}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching tokens data:", err);
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

  // Get input tokens from breakdown
  const inputTokens = data?.breakdown?.inputTokens || 0;

  const displayValue = inputTokens.toLocaleString();
  const changeText = error 
    ? "Error loading data" 
    : `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title="Input Tokens"
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
