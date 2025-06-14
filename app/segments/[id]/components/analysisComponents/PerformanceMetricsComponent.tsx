import React from "react";
import { BaseAnalysisComponentProps } from "./types";
import { SegmentMetricsWidget } from "../SegmentMetricsWidget";

interface PerformanceMetricsComponentProps extends Pick<BaseAnalysisComponentProps, 'isDarkMode'> {
  segmentId: string;
  startDate?: Date;
  endDate?: Date;
}

export const PerformanceMetricsComponent: React.FC<PerformanceMetricsComponentProps> = ({ 
  isDarkMode, 
  segmentId, 
  startDate, 
  endDate 
}) => {
  return (
    <SegmentMetricsWidget 
      segmentId={segmentId}
      startDate={startDate}
      endDate={endDate}
    />
  );
}; 