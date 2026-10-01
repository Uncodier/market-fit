"use client";

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { ReportState } from "../report-state";
import { useTrafficMetric, type TrafficMetricFilters } from "./use-traffic-metric";

export function ClientConversionWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: TrafficMetricFilters) {
  const metric = useTrafficMetric("client-conversion", { segmentId, startDate: propStartDate, endDate: propEndDate });

  return (
    <BaseKpiWidget
      title="Lead to Client"
      tooltipText="Percentage of leads that became clients (have at least one sale)"
      value={metric.data?.actual != null ? `${metric.data.actual}%` : "—"}
      changeText={metric.changeText}
      isPositiveChange={metric.isPositiveChange}
      isLoading={metric.isLoading}
      customStatus={metric.error && <ReportState state="error" message={metric.error.message} onRetry={() => { void metric.mutate() }} />}
      showDatePicker={false}  // Always use parent dates for consistency
      startDate={metric.startDate}
      endDate={metric.endDate}
      onDateChange={() => {}} // No-op since we use parent dates
      segmentBadge={segmentId !== "all"}
    />
  );
} 