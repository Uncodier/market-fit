"use client";

import { useState, useEffect } from "react";
import { subDays } from "date-fns";
import { BaseKpiWidget } from "./base-kpi-widget";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches";

interface ActiveSegmentsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

interface ActiveSegmentsData {
  actual: number;
  percentChange: number;
  periodType: string;
  error?: string;
}

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

export function ActiveSegmentsWidget({
  startDate: propStartDate,
  endDate: propEndDate
}: ActiveSegmentsWidgetProps) {
  const { t } = useLocalization();
  const { currentSite } = useSite();
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const { data: activeSegments, isLoading } = useOverviewSlice<ActiveSegmentsData>(
    "active-segments",
    startDate,
    endDate
  );

  const hasError = Boolean(activeSegments?.error);
  let customStatus = null;
  let formattedValue = null;
  let changeText = null;
  let isPositiveChange = undefined;

  if (hasError) {
    customStatus = <div className="text-sm text-red-500">Error loading segments data</div>;
  } else if (!currentSite || currentSite.id === "default") {
    formattedValue = "-";
    customStatus = <p className="text-xs text-muted-foreground">No site selected</p>;
  } else if (activeSegments && activeSegments.actual === 0) {
    formattedValue = "0";
    customStatus = <p className="text-xs text-muted-foreground">No active segments</p>;
  } else {
    formattedValue = activeSegments?.actual != null ? activeSegments.actual.toLocaleString() : "0";
    changeText = `${activeSegments?.percentChange || 0}% from ${formatPeriodType(activeSegments?.periodType || "monthly")}`;
    isPositiveChange = (activeSegments?.percentChange || 0) > 0;
  }

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.activeSegments') || 'Active Segments'}
      tooltipText={`Number of active user segments for site: ${currentSite?.name || currentSite?.id}`}
      value={formattedValue}
      changeText={changeText || ""}
      isPositiveChange={isPositiveChange}
      isLoading={isLoading}
      customStatus={customStatus}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={startDate}
      endDate={endDate}
      onDateChange={(start, end) => {
        setStartDate(start);
        setEndDate(end);
      }}
    />
  );
}
