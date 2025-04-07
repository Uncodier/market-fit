'use client';

import React from "react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleSize?: "sm" | "md" | "lg";
  showHeader?: boolean;
  showContent?: boolean;
  contentHeight?: string;
  contentLines?: number;
}

/**
 * SkeletonCard component
 * 
 * Use this component for loading states across the application.
 * It provides consistent styling for skeleton/loading states in cards.
 * 
 * Example usage:
 * ```tsx
 * // Basic usage
 * <SkeletonCard />
 * 
 * // Advanced usage
 * <SkeletonCard 
 *   titleSize="lg"
 *   contentLines={5}
 *   className="h-full"
 * />
 * 
 * // Content only (no header)
 * <SkeletonCard 
 *   showHeader={false}
 *   contentHeight="h-40"
 * />
 * ```
 */
export function SkeletonCard({
  className,
  headerClassName,
  contentClassName,
  titleSize = "md",
  showHeader = true,
  showContent = true,
  contentHeight,
  contentLines = 3
}: SkeletonCardProps) {
  const titleSizeClass = {
    sm: "h-4 w-1/2",
    md: "h-5 w-2/3",
    lg: "h-6 w-3/4"
  };

  return (
    <Card className={cn("animate-pulse bg-card text-card-foreground", className)}>
      {showHeader && (
        <CardHeader className={cn("space-y-2", headerClassName)}>
          <Skeleton className={cn(titleSizeClass[titleSize])} />
          <Skeleton className="h-3 w-1/3" />
        </CardHeader>
      )}
      {showContent && (
        <CardContent className={cn("space-y-2", contentClassName)}>
          {contentHeight ? (
            <Skeleton className={cn("w-full", contentHeight)} />
          ) : (
            Array(contentLines)
              .fill(0)
              .map((_, i) => (
                <Skeleton 
                  key={i} 
                  className={cn(
                    "h-4 w-full", 
                    i === contentLines - 1 ? "w-4/5" : "w-full"
                  )} 
                />
              ))
          )}
        </CardContent>
      )}
    </Card>
  );
} 