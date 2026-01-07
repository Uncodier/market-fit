import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { LEAD_STATUSES, STATUS_STYLES } from "@/app/leads/types";

interface StatusSegmentBarProps {
  currentStatus: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified";
  onStatusChange: (status: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified") => void;
}

export function StatusSegmentBar({ currentStatus, onStatusChange }: StatusSegmentBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
      <div className="flex space-x-2">
        {LEAD_STATUSES.map((status) => (
          <Badge 
            key={status.id} 
            className={`px-3 py-1 text-sm cursor-pointer transition-colors duration-200 ${
              currentStatus === status.id 
                ? STATUS_STYLES[status.id] 
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent'
            }`}
            onClick={() => onStatusChange(status.id as "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified")}
          >
            {status.name}
          </Badge>
        ))}
      </div>
    </div>
  );
} 