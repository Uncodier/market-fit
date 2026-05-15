'use client';

import React from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyCardProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actionButton?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showShadow?: boolean;
  variant?: "simple" | "fancy";
  showHint?: boolean;
}

// Use deterministic positions for bubbles to prevent hydration mismatch
const generateRandomBubbles = () => {
  const positions = [
    { top: 25.4, left: 12.3, size: 28.5, delay: 1.2 },
    { top: 68.1, left: 45.7, size: 22.1, delay: 0.5 },
    { top: 15.8, left: 63.2, size: 18.4, delay: 2.1 },
    { top: 42.6, left: 28.9, size: 16.7, delay: 1.8 },
    { top: 58.3, left: 74.5, size: 12.3, delay: 0.9 },
    { top: 31.2, left: 56.4, size: 19.8, delay: 2.5 }
  ];
  return positions;
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
 *   showHint={true}
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
  showShadow = true,
  variant = "fancy",
  showHint = false
}: EmptyCardProps) {
  const isSimple = variant === "simple"
  
  // Generate random bubble positions on component mount
  const [bubblePositions] = React.useState(() => generateRandomBubbles());
  
  return (
    <div className="relative">
      {/* Floating background orbs - removed per user request */}
      
      <Card className={cn(
        showShadow ? "border-dashed bg-card/50" : "border-0 bg-transparent shadow-none", 
        "w-full relative z-0",
        className
      )}>
        <CardContent className={cn(
          "flex flex-col items-center justify-center px-6 pb-0 relative z-[1] min-h-[300px]", 
          contentClassName
        )}>
          {isSimple ? (
            // Simple version: more subtle styling
            <div className="flex flex-col items-center justify-center space-y-3">
              {icon && (
                <div className="flex justify-center items-center">
                  <div className="w-16 h-16 flex items-center justify-center text-muted-foreground/60">
                    <div className="[&>*]:!w-16 [&>*]:!h-16 [&_svg]:!stroke-current [&_svg]:!fill-current [&_svg_*]:!stroke-current [&_svg_*]:!fill-none flex items-center justify-center">
                      {icon}
                    </div>
                  </div>
                </div>
              )}
              
              {title && (
                <h3 className="text-sm font-medium text-muted-foreground text-center">{title}</h3>
              )}
              
              {description && (
                <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-sm mx-auto text-center">
                  {description}
                </p>
              )}
              
              {actionButton && (
                <div className="pt-1">
                  {actionButton}
                </div>
              )}
            </div>
          ) : (
            // Fancy version: more subtle text styling
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Hero section with icon */}
              <div className="flex flex-col items-center space-y-3">
                <div className="relative z-[2]">
                  {/* Main icon container - smaller and more subtle */}
                  <div className="w-16 h-16 mx-auto rounded-lg bg-primary/8 backdrop-blur-sm border border-primary/15 flex items-center justify-center shadow-sm">
                    <div className="text-primary/70 flex items-center justify-center [&>*]:!w-6 [&>*]:!h-6 [&_svg]:!stroke-primary/70 [&_svg]:!fill-primary/70 [&_svg_*]:!stroke-primary/70 [&_svg_*]:!fill-none">
                      {icon}
                    </div>
                  </div>
                </div>
                
                {title && (
                  <h3 className="text-sm font-medium text-muted-foreground relative z-[2] text-center">{title}</h3>
                )}
                
                {description && (
                  <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-md mx-auto relative z-[2] text-center">
                    {description}
                  </p>
                )}
              </div>

              {/* Action button */}
              {actionButton && (
                <div className="relative z-[2] pt-1">
                  {actionButton}
                </div>
              )}
              
              {/* Optional automatic operation hint */}
              {showHint && (
                <div className="pt-3 border-t dark:border-white/5 border-black/5/20 relative z-[2]">
                  <p className="text-xs text-muted-foreground/50 max-w-sm mx-auto leading-relaxed text-center">
                    💡 <span className="font-medium">Most operations run automatically.</span> Your AI agents work in the background without manual direction. Feel free to return later if you prefer not to actively manage them right now.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 