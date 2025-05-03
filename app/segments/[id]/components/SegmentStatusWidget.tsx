import React from "react";
import { Badge } from "@/app/components/ui/badge";

interface SegmentStatusWidgetProps {
  isActive: boolean;
  onStatusChange: () => Promise<void>;
}

export function SegmentStatusWidget({ isActive, onStatusChange }: SegmentStatusWidgetProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
      <div className="flex space-x-2">
        <Badge 
          className={`cursor-pointer transition-colors duration-200 ${
            !isActive 
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200" 
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent"
          }`}
          onClick={() => {
            if (isActive) {
              onStatusChange();
            }
          }}
        >
          Draft
        </Badge>
        <Badge 
          className={`cursor-pointer transition-colors duration-200 ${
            isActive 
              ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200" 
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent"
          }`}
          onClick={() => {
            if (!isActive) {
              onStatusChange();
            }
          }}
        >
          Active
        </Badge>
      </div>
    </div>
  );
} 