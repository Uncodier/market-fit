"use client";

import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { useLocalization } from "@/app/context/LocalizationContext";

const SALE_STATUSES = [
  { id: 'pending' as const, key: 'sales.status.pending', fallback: 'Pending' },
  { id: 'completed' as const, key: 'sales.status.completed', fallback: 'Completed' },
  { id: 'cancelled' as const, key: 'sales.status.cancelled', fallback: 'Cancelled' },
  { id: 'refunded' as const, key: 'sales.status.refunded', fallback: 'Refunded' },
];

const STATUS_STYLES = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
};

interface StatusBarProps {
  currentStatus: "pending" | "completed" | "cancelled" | "refunded";
  onStatusChange: (status: "pending" | "completed" | "cancelled" | "refunded") => void;
}

export function StatusBar({ currentStatus, onStatusChange }: StatusBarProps) {
  const { t } = useLocalization();

  return (
    <div className="flex items-center gap-3">
      <div className="flex space-x-2">
        {SALE_STATUSES.map((status) => (
          <Badge
            key={status.id}
            className={`px-3 py-1 text-sm cursor-pointer transition-colors duration-200 ${
              currentStatus === status.id
                ? STATUS_STYLES[status.id]
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent'
            }`}
            onClick={() => onStatusChange(status.id)}
          >
            {t(status.key) || status.fallback}
          </Badge>
        ))}
      </div>
    </div>
  );
}
