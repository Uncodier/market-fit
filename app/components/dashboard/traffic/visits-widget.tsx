"use client";

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { ReportState } from "../report-state";
import { useTrafficMetric, type TrafficMetricFilters } from "./use-traffic-metric";

export function SessionsWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: TrafficMetricFilters) {
  const metric = useTrafficMetric("visits", { segmentId, startDate: propStartDate, endDate: propEndDate });

  return (
    <BaseKpiWidget
      title="Sessions"
      tooltipText="Total number of sessions to your site"
      value={metric.data?.actual != null ? metric.data.actual.toLocaleString() : "—"}
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