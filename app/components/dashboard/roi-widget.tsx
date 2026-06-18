"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useAuth } from "@/app/hooks/use-auth";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";

interface ROIWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface ROIData {
  actual: number;
  unit: string;
  percentChange: number;
  periodType: string;
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

export function ROIWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: ROIWidgetProps) {
  const { t } = useLocalization();
  const { currentSite } = useSite();
  const { user } = useAuth();
  const { shouldExecuteWidgets } = useWidgetContext();
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

  const { data: roi, isLoading: isSWRisLoading } = useSWR(
    shouldExecuteWidgets && currentSite && currentSite.id !== "default"
      ? [
          'roi',
          segmentId,
          currentSite.id,
          user?.id,
          startDate ? format(startDate, "yyyy-MM-dd") : null,
          endDate ? format(endDate, "yyyy-MM-dd") : null
        ]
      : null,
    async ([_, segId, siteId, userId, start, end]) => {
      const params = new URLSearchParams();
      params.append("segmentId", segId as string);
      params.append("siteId", siteId as string);
      if (userId) {
        params.append("userId", userId as string);
      }
      if (start) params.append("startDate", start as string);
      if (end) params.append("endDate", end as string);
      
      const response = await fetchWithRetry(
        fetch,
        `/api/roi?${params.toString()}`,
        { maxRetries: 3 }
      );
      
      if (!response) {
        return null;
      }
      return await response.json() as ROIData;
    }
  );

  const isLoading = isSWRisLoading;

  // Handle date range selection
  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formattedValue = roi ? `${roi.actual}${roi.unit}` : "0%";
  const changeText = `${roi?.percentChange || 0}% from ${formatPeriodType(roi?.periodType || "monthly")}`;
  const isPositiveChange = (roi?.percentChange || 0) > 0;
  
  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.roi') || 'ROI'}
      tooltipText="Return on Investment"
      value={formattedValue}
      changeText={changeText}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={handleDateChange}
      segmentBadge={segmentId !== "all"}
    />
  );
} 