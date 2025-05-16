import React from "react";
import { Badge } from "@/app/components/ui/badge";

// Sale status options
const SALE_STATUSES = [
  { id: 'draft', name: 'Draft' },
  { id: 'pending', name: 'Pending' },
  { id: 'completed', name: 'Completed' },
  { id: 'cancelled', name: 'Cancelled' },
  { id: 'refunded', name: 'Refunded' }
];

// Status styles from the sales page with explicit hover states
const STATUS_STYLES = {
  draft: "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
};

interface StatusBarProps {
  currentStatus: "draft" | "pending" | "completed" | "cancelled" | "refunded";
  onStatusChange: (status: "draft" | "pending" | "completed" | "cancelled" | "refunded") => void;
}

export function StatusBar({ currentStatus, onStatusChange }: StatusBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
      <div className="flex space-x-2">
        {SALE_STATUSES.map((status) => (
          <Badge 
            key={status.id} 
            className={`px-3 py-1 text-sm cursor-pointer transition-colors duration-200 ${
              currentStatus === status.id 
                ? STATUS_STYLES[status.id] 
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent'
            }`}
            onClick={() => onStatusChange(status.id as "draft" | "pending" | "completed" | "cancelled" | "refunded")}
          >
            {status.name}
          </Badge>
        ))}
      </div>
    </div>
  );
} 