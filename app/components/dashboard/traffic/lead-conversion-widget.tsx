"use client";

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";
import { ReportState } from "../report-state";
import { useTrafficMetric, type TrafficMetricFilters } from "./use-traffic-metric";

export function LeadConversionWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: TrafficMetricFilters) {
  const metric = useTrafficMetric("lead-conversion", { segmentId, startDate: propStartDate, endDate: propEndDate });

  return (
    <BaseKpiWidget
      title="Visitor to Lead"
      tooltipText="Percentage of visitors who become leads"
      value={metric.data?.actual != null ? `${metric.data.actual.toFixed(1)}%` : "—"}
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