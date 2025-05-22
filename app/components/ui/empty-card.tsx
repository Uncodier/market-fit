'use client';

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyCardProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actionButton?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  showShadow?: boolean;
}

/**
 * EmptyCard component
 * 
 * Use this component to display an empty state within a card.
 * It provides consistent styling for empty states across the application.
 * 
 * Example usage:
 * ```tsx
 * <EmptyCard 
 *   icon={<FileText className="h-10 w-10 text-muted-foreground" />}
 *   title="No documents found"
 *   description="There are no documents in this section yet."
 *   actionButton={<Button size="sm">Add Document</Button>}
 * />
 * ```
 */
export function EmptyCard({
  icon,
  title = "No data available",
  description = "There's no data to display at this time.",
  actionButton,
  className,
  contentClassName,
  headerClassName,
  showShadow = true
}: EmptyCardProps) {
  return (
    <Card className={cn(
      showShadow ? "border-dashed bg-card/50" : "border-0 bg-transparent shadow-none", 
      "w-full",
      className
    )}>
      {(title || description) && (
        <CardHeader className={cn("space-y-1 text-center", headerClassName)}>
          {title && <CardTitle className="text-base font-medium text-muted-foreground">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn("flex flex-col items-center justify-center py-6", contentClassName)}>
        {icon && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/30 mb-4">
            {icon}
          </div>
        )}
        {actionButton && <div className="mt-4">{actionButton}</div>}
      </CardContent>
    </Card>
  );
} 