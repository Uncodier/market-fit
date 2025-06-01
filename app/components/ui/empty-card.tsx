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

// Generate random positions for bubbles
const generateRandomBubbles = () => {
  const bubbles = [];
  const positions = [
    { 
      top: Math.random() * 70 + 5, 
      left: Math.random() * 70 + 5,
      size: Math.random() * 16 + 16, // 16-32
      delay: Math.random() * 3
    },
    { 
      top: Math.random() * 70 + 10, 
      left: Math.random() * 70 + 10,
      size: Math.random() * 12 + 20, // 20-32
      delay: Math.random() * 3
    },
    { 
      top: Math.random() * 70 + 15, 
      left: Math.random() * 70 + 15,
      size: Math.random() * 8 + 16, // 16-24
      delay: Math.random() * 3
    },
    { 
      top: Math.random() * 70 + 8, 
      left: Math.random() * 70 + 8,
      size: Math.random() * 10 + 12, // 12-22
      delay: Math.random() * 3
    },
    { 
      top: Math.random() * 70 + 20, 
      left: Math.random() * 70 + 20,
      size: Math.random() * 6 + 10, // 10-16
      delay: Math.random() * 3
    },
    { 
      top: Math.random() * 70 + 25, 
      left: Math.random() * 70 + 25,
      size: Math.random() * 8 + 14, // 14-22
      delay: Math.random() * 3
    },
  ];
  
  return positions;
};

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
      {/* Floating background orbs - outside card for visibility */}
      {!isSimple && (
        <div className="absolute inset-0 pointer-events-none z-0">
          {/* Randomized bubbles */}
          <div 
            className="absolute bg-violet-500/25 rounded-full blur-2xl animate-pulse"
            style={{ 
              top: `${bubblePositions[0].top}%`, 
              left: `${bubblePositions[0].left}%`,
              width: `${bubblePositions[0].size * 4}px`,
              height: `${bubblePositions[0].size * 4}px`,
              animationDelay: `${bubblePositions[0].delay}s`
            }}
          ></div>
          <div 
            className="absolute bg-indigo-500/20 rounded-full blur-2xl animate-pulse"
            style={{ 
              top: `${bubblePositions[1].top}%`, 
              left: `${bubblePositions[1].left}%`,
              width: `${bubblePositions[1].size * 4}px`,
              height: `${bubblePositions[1].size * 4}px`,
              animationDelay: `${bubblePositions[1].delay}s`
            }}
          ></div>
          <div 
            className="absolute bg-purple-500/22 rounded-full blur-2xl animate-pulse"
            style={{ 
              top: `${bubblePositions[2].top}%`, 
              left: `${bubblePositions[2].left}%`,
              width: `${bubblePositions[2].size * 4}px`,
              height: `${bubblePositions[2].size * 4}px`,
              animationDelay: `${bubblePositions[2].delay}s`
            }}
          ></div>
          <div 
            className="absolute bg-pink-500/24 rounded-full blur-xl animate-pulse"
            style={{ 
              top: `${bubblePositions[3].top}%`, 
              left: `${bubblePositions[3].left}%`,
              width: `${bubblePositions[3].size * 4}px`,
              height: `${bubblePositions[3].size * 4}px`,
              animationDelay: `${bubblePositions[3].delay}s`
            }}
          ></div>
          <div 
            className="absolute bg-emerald-500/18 rounded-full blur-xl animate-pulse"
            style={{ 
              top: `${bubblePositions[4].top}%`, 
              left: `${bubblePositions[4].left}%`,
              width: `${bubblePositions[4].size * 4}px`,
              height: `${bubblePositions[4].size * 4}px`,
              animationDelay: `${bubblePositions[4].delay}s`
            }}
          ></div>
          <div 
            className="absolute bg-cyan-500/19 rounded-full blur-xl animate-pulse"
            style={{ 
              top: `${bubblePositions[5].top}%`, 
              left: `${bubblePositions[5].left}%`,
              width: `${bubblePositions[5].size * 4}px`,
              height: `${bubblePositions[5].size * 4}px`,
              animationDelay: `${bubblePositions[5].delay}s`
            }}
          ></div>
        </div>
      )}
      
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
                <div className="pt-3 border-t border-border/20 relative z-[2]">
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