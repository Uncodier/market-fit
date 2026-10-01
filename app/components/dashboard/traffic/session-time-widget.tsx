"use client";

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { ReportState } from "../report-state";
import { useTrafficMetric, type TrafficMetricFilters } from "./use-traffic-metric";

const formatSessionTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

export function SessionTimeWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: TrafficMetricFilters) {
  const metric = useTrafficMetric("session-time", { segmentId, startDate: propStartDate, endDate: propEndDate });

  return (
    <BaseKpiWidget
      title="Average Session Time"
      tooltipText="Average time visitors spend on your site"
      value={metric.data?.actual != null ? formatSessionTime(metric.data.actual) : "—"}
      changeText={metric.changeText}
      isPositiveChange={metric.isPositiveChange}
      isLoading={metric.isLoading}
      customStatus={metric.error && <ReportState state="error" message={metric.error.message} onRetry={() => { void metric.mutate() }} />}
      showDatePicker={!propStartDate && !propEndDate}
      startDate={metric.startDate}
      endDate={metric.endDate}
      onDateChange={metric.onDateChange}
      segmentBadge={segmentId !== "all"}
    />
  );
} 