"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { CalendarIcon } from "@/app/components/ui/icons";
import { Skeleton } from "@/app/components/ui/skeleton";
import { DatePicker } from "@/app/components/ui/date-picker";
import { format } from "date-fns";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Badge } from "@/app/components/ui/badge";
import { useTheme } from "@/app/context/ThemeContext";

export interface BaseKpiWidgetProps {
  title: string;
  value: string | number | null;
  changeText: string;
  isPositiveChange?: boolean;
  isLoading: boolean;
  showDatePicker?: boolean;
  startDate?: Date;
  endDate?: Date;
  onDateChange?: (start: Date, end: Date) => void;
  segmentBadge?: boolean;
  customStatus?: ReactNode;
  className?: string;
}

// Custom hook for count-up animation
function useCountUp(value: string | number | null, isLoading: boolean) {
  const [displayValue, setDisplayValue] = useState<string>("0");
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Clear any existing animation or timeout
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    if (isLoading) {
      setDisplayValue("0");
      setIsAnimating(false);
      return;
    }

    if (value === null || value === undefined) {
      setDisplayValue("0");
      return;
    }

    const stringValue = String(value);
    
    // Check if the value is a number (for count-up effect)
    const numericMatch = stringValue.match(/^[\$]?([\d,]+\.?\d*)([%]?)$/);
    
    if (numericMatch) {
      const prefix = stringValue.startsWith('$') ? '$' : '';
      const suffix = stringValue.endsWith('%') ? '%' : '';
      const numericValue = parseFloat(numericMatch[1].replace(/,/g, ''));
      
      if (!isNaN(numericValue) && numericValue > 0) {
        setIsAnimating(true);
        
        const startValue = 0;
        const endValue = numericValue;
        const duration = 1000; // 1 second
        const startTime = performance.now();
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Easing function (ease-out cubic)
          const easeOut = 1 - Math.pow(1 - progress, 3);
          const currentValue = startValue + (endValue - startValue) * easeOut;
          
          let formattedValue = currentValue.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: endValue < 100 ? 1 : 0
          });
          
          setDisplayValue(prefix + formattedValue + suffix);
          
          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            setIsAnimating(false);
            setDisplayValue(stringValue); // Ensure final value is exact
          }
        };
        
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // For zero or negative values, just set directly
        setDisplayValue(stringValue);
      }
    } else {
      // For non-numeric values, just set directly with delay
      timeoutRef.current = setTimeout(() => {
        setDisplayValue(stringValue);
      }, 200);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, isLoading]);

  return { displayValue, isAnimating };
}

export function BaseKpiWidget({
  title,
  value,
  changeText,
  isPositiveChange,
  isLoading,
  showDatePicker = false,
  startDate,
  endDate,
  onDateChange,
  segmentBadge = false,
  customStatus,
  className
}: BaseKpiWidgetProps) {
  const { isDarkMode } = useTheme();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const { displayValue, isAnimating } = useCountUp(value, isLoading);

  // Add artificial delay to show loading animation
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isLoading]);

  // Handle date range selection
  const handleRangeSelect = (start: Date, end: Date) => {
    if (onDateChange) {
      onDateChange(start, end);
    }
    setIsDatePickerOpen(false);
  };

  // Local date handlers for DatePicker
  const setStartDate = (date: Date) => {
    if (onDateChange && endDate) {
      onDateChange(date, endDate);
    }
  };

  const setEndDate = (date: Date) => {
    if (onDateChange && startDate) {
      onDateChange(startDate, date);
    }
  };

  return (
    <Card className={`${className} h-[116.5px]`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-3 pb-0">
        <CardTitle className="text-sm font-medium">
          {title}
          {segmentBadge && (
            <span className="ml-1 text-xs text-muted-foreground">(Segment)</span>
          )}
        </CardTitle>
        <div className="flex items-center space-x-2">
          {customStatus && (
            <div className="flex items-center">
              {customStatus}
            </div>
          )}
          {showDatePicker && startDate && endDate && (
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1 h-auto"
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {format(startDate, "MMM dd")} - {format(endDate, "MMM dd")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <DatePicker
                  date={startDate}
                  setDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  mode="range"
                  onRangeSelect={handleRangeSelect}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2 pb-3">
        {isLoading || !showContent ? (
          <div className="flex flex-col animate-pulse">
            <div className="h-8 flex items-center pt-1">
              <div className="relative w-full max-w-[120px] overflow-hidden">
                <div className={`h-7 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent kpi-shimmer" />
              </div>
            </div>
            <div className="h-[18px] flex items-center mt-1">
              <div className="relative w-full max-w-[100px] overflow-hidden">
                <div className={`h-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent kpi-shimmer" style={{animationDelay: '0.5s'}} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="text-2xl font-bold pt-1 h-8 flex items-center kpi-fade-in">
              {displayValue}
            </div>
            {customStatus || (
              <p className="text-xs text-muted-foreground mt-1 h-[18px] flex items-center kpi-fade-in-delayed">
                {isPositiveChange !== undefined && (
                  <span className={isPositiveChange ? "text-green-500" : "text-red-500"}>
                    {isPositiveChange ? '+' : ''}{changeText.split(' ')[0]}
                  </span>
                )}
                {" "}{changeText.split(' ').slice(1).join(' ')}
              </p>
            )}
          </div>
        )}
      </CardContent>
      
      <style jsx global>{`
        @keyframes kpi-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes kpi-fade-in {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        .kpi-shimmer {
          animation: kpi-shimmer 1.5s infinite;
        }
        
        .kpi-fade-in {
          animation: kpi-fade-in 0.6s ease-out forwards;
        }
        
        .kpi-fade-in-delayed {
          animation: kpi-fade-in 0.6s ease-out 0.2s forwards;
          opacity: 0;
        }
      `}</style>
    </Card>
  );
} 