"use client";

import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { useLocalization } from "@/app/context/LocalizationContext";

const EXPENSE_TYPES = [
  { id: 'fixed' as const, key: 'expenses.type.fixed', fallback: 'Fixed' },
  { id: 'variable' as const, key: 'expenses.type.variable', fallback: 'Variable' },
];

const TYPE_STYLES = {
  fixed: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  variable: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
};

interface TypeBarProps {
  currentType: "fixed" | "variable";
  onTypeChange: (type: "fixed" | "variable") => void;
}

export function TypeBar({ currentType, onTypeChange }: TypeBarProps) {
  const { t } = useLocalization();

  return (
    <div className="flex items-center gap-3">
      <div className="flex space-x-2">
        {EXPENSE_TYPES.map((type) => (
          <Badge
            key={type.id}
            className={`px-3 py-1 text-sm cursor-pointer transition-colors duration-200 ${
              currentType === type.id
                ? TYPE_STYLES[type.id]
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent'
            }`}
            onClick={() => onTypeChange(type.id)}
          >
            {t(type.key) || type.fallback}
          </Badge>
        ))}
      </div>
    </div>
  );
}
