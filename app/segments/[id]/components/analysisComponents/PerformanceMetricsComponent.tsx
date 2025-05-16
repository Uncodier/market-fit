import React from "react";
import { AnalysisComponentProps } from "./types";
import { Users, CheckCircle2, MessageSquare, TrendingUp } from "@/app/components/ui/icons";
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget";

interface PerformanceMetricsComponentProps extends Pick<AnalysisComponentProps, 'isDarkMode'> {}

// Define a local version of PerformanceMetric that allows string values
interface PlaceholderMetric {
  name: string;
  value: number | string;
  change: number;
  icon: React.ReactNode;
  tooltipText: string;
}

export const PerformanceMetricsComponent: React.FC<PerformanceMetricsComponentProps> = ({ isDarkMode }) => {
  // Create placeholder metrics with 0 instead of "Not available" message
  const placeholderMetrics: PlaceholderMetric[] = [
    { 
      name: "Visitors", 
      value: 0, 
      change: 0, 
      icon: <Users className="h-4 w-4" />,
      tooltipText: "Number of unique visitors to your segment's content"
    },
    { 
      name: "Clicks", 
      value: 0, 
      change: 0, 
      icon: <CheckCircle2 className="h-4 w-4" />,
      tooltipText: "Number of clicks on your segment's content"
    },
    { 
      name: "Conversions", 
      value: 0, 
      change: 0, 
      icon: <MessageSquare className="h-4 w-4" />,
      tooltipText: "Number of conversions from your segment" 
    },
    { 
      name: "CTR", 
      value: "0%", 
      change: 0, 
      icon: <TrendingUp className="h-4 w-4" />,
      tooltipText: "Click-through rate for your segment's content"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {placeholderMetrics.map((metric, index) => (
        <BaseKpiWidget
          key={index}
          title={metric.name}
          value={typeof metric.value === 'number' && metric.name === 'CTR' ? `${metric.value}%` : metric.value}
          changeText="No data available yet"
          tooltipText={metric.tooltipText}
          isLoading={false}
          customStatus={
            <p className="text-xs text-muted-foreground mt-1">No data available yet</p>
          }
        />
      ))}
    </div>
  );
}; 