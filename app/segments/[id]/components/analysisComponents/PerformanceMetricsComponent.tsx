import React from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import { AnalysisComponentProps } from "./types";
import { Users, CheckCircle2, MessageSquare, TrendingUp } from "@/app/components/ui/icons";

interface PerformanceMetricsComponentProps extends Pick<AnalysisComponentProps, 'isDarkMode'> {}

// Define a local version of PerformanceMetric that allows string values
interface PlaceholderMetric {
  name: string;
  value: number | string;
  change: number;
  icon: React.ReactNode;
}

export const PerformanceMetricsComponent: React.FC<PerformanceMetricsComponentProps> = ({ isDarkMode }) => {
  // Create placeholder metrics with 0 instead of "Not available" message
  const placeholderMetrics: PlaceholderMetric[] = [
    { 
      name: "Visitors", 
      value: 0, 
      change: 0, 
      icon: <Users className="h-4 w-4" /> 
    },
    { 
      name: "Clicks", 
      value: 0, 
      change: 0, 
      icon: <CheckCircle2 className="h-4 w-4" /> 
    },
    { 
      name: "Conversions", 
      value: 0, 
      change: 0, 
      icon: <MessageSquare className="h-4 w-4" /> 
    },
    { 
      name: "CTR", 
      value: 0, 
      change: 0, 
      icon: <TrendingUp className="h-4 w-4" /> 
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {placeholderMetrics.map((metric, index) => (
        <Card key={index} className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
                <h3 className="text-2xl font-bold mt-1 text-muted-foreground">
                  {typeof metric.value === 'number' && metric.name === 'CTR' 
                    ? `${metric.value}%` 
                    : metric.value}
                </h3>
              </div>
              <div className={`p-2 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {metric.icon}
              </div>
            </div>
            <div className="mt-2 flex items-center">
              <span className="text-xs text-muted-foreground">No data available yet</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}; 