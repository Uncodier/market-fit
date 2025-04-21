"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { HelpCircle, CalendarIcon } from "@/app/components/ui/icons";
import { Skeleton } from "@/app/components/ui/skeleton";
import { DatePicker } from "@/app/components/ui/date-picker";
import { format, subDays } from "date-fns";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Badge } from "@/app/components/ui/badge";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";

interface RevenueWidgetProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface RevenueData {
  actual: number;
  projected: number;
  estimated: number;
  currency: string;
  percentChange: number;
  periodType: string;
}

// Format currency
const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
};

// Format period type for display
const formatPeriodType = (periodType: string): string => {
  switch (periodType) {
    case "daily": return "yesterday";
    case "weekly": return "last week";
    case "monthly": return "last month";
    case "quarterly": return "last quarter";
    case "yearly": return "last year";
    default: return "previous period";
  }
};

export function RevenueWidget({ 
  segmentId = "all",
  startDate: propStartDate,
  endDate: propEndDate
}: RevenueWidgetProps) {
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Update local state when props change
  useEffect(() => {
    if (propStartDate) {
      setStartDate(propStartDate);
    }
    if (propEndDate) {
      setEndDate(propEndDate);
    }
  }, [propStartDate, propEndDate]);

  useEffect(() => {
    const fetchRevenue = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      try {
        const start = startDate ? format(startDate, "yyyy-MM-dd") : null;
        const end = endDate ? format(endDate, "yyyy-MM-dd") : null;
        
        const params = new URLSearchParams();
        params.append("segmentId", segmentId);
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);
        
        const response = await fetch(`/api/revenue?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch revenue data');
        }
        const data = await response.json();
        setRevenue(data);
      } catch (error) {
        console.error("Error fetching revenue:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRevenue();
  }, [segmentId, startDate, endDate, currentSite, user]);

  // Handle date range selection
  const handleRangeSelect = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setIsDatePickerOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Total Revenue
        </CardTitle>
        <div className="flex items-center space-x-2">
          {!propStartDate && !propEndDate && (
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  <span>
                    {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto" position="bottom">
                <div className="flex flex-col p-2">
                  <div className="flex gap-2 items-center pb-2">
                    <Badge variant="outline" className="text-xs py-1">
                      {format(startDate, "MMM d, yyyy")}
                    </Badge>
                    <span>to</span>
                    <Badge variant="outline" className="text-xs py-1">
                      {format(endDate, "MMM d, yyyy")}
                    </Badge>
                  </div>
                  <DatePicker 
                    date={startDate}
                    setDate={setStartDate}
                    className="w-full"
                    mode="report"
                    onRangeSelect={handleRangeSelect}
                    placeholder="Select date range"
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              Total revenue across {segmentId === "all" ? "all segments" : "selected segment"}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-32 mb-1" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {revenue ? formatCurrency(revenue.actual, revenue.currency) : "$0"}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={(revenue?.percentChange || 0) > 0 ? "text-green-500" : "text-red-500"}>
                {(revenue?.percentChange || 0) > 0 ? '+' : ''}{revenue?.percentChange || 0}%
              </span> from {formatPeriodType(revenue?.periodType || "monthly")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
} 