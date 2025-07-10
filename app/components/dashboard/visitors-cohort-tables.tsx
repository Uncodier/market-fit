"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { format, subDays } from "date-fns"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart } from "@/app/components/ui/icons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"

interface VisitorsCohortTablesProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Types for visitor cohort data
interface VisitorCohortData {
  cohort: string
  weeks: number[]
}

interface VisitorCohortResponse {
  visitorCohorts: VisitorCohortData[];
}

// Calculate color intensity based on value
function getColorIntensity(value: number, isDarkMode: boolean) {
  // Base colors for visitor cohorts - using purple/violet theme to differentiate from sales cohorts
  const baseColor = isDarkMode ? [167, 139, 250] : [139, 92, 246]; // violet-400 : violet-500
  
  // Calculate opacity based on value (higher value = more intense color)
  const opacity = Math.max(0.1, value / 100);
  
  return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${opacity})`;
}

// Function to create gradient backgrounds for visitor cohort cells
function getGradientBackground(value: number, isDarkMode: boolean) {
  // Base colors - from lighter to darker violet for visitor cohorts
  const baseLight = isDarkMode ? [196, 181, 253] : [167, 139, 250]; // violet-300 or violet-400
  const baseDark = isDarkMode ? [139, 92, 246] : [124, 58, 237]; // violet-500 or violet-600
  
  // Calculate opacity based on value (higher value = more intense color)
  const opacity = Math.max(0.1, value / 100);
  
  // Enhanced gradient with subtle effect
  return `linear-gradient(135deg, 
    rgba(${baseLight[0]}, ${baseLight[1]}, ${baseLight[2]}, ${opacity}) 0%, 
    rgba(${baseLight[0] - 10}, ${baseLight[1] - 10}, ${baseLight[2]}, ${opacity}) 30%,
    rgba(${baseDark[0]}, ${baseDark[1]}, ${baseDark[2]}, ${opacity}) 100%)`;
}

export function VisitorsCohortTables({ segmentId = "all", startDate: propStartDate, endDate: propEndDate }: VisitorsCohortTablesProps) {
  const { isDarkMode } = useTheme();
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [visitorCohortData, setVisitorCohortData] = useState<VisitorCohortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date())
  

  
  // Update local state when props change - WITH VALIDATION
  useEffect(() => {
    const now = new Date();
    
    if (propStartDate) {
      // FORCE validation: if date is in the future, use safe default
      if (propStartDate > now) {
        setStartDate(subDays(now, 30));
      } else {
        setStartDate(propStartDate);
      }
    }
    
    if (propEndDate) {
      // FORCE validation: if date is in the future, use safe default
      if (propEndDate > now) {
        setEndDate(now);
      } else {
        setEndDate(propEndDate);
      }
    }
  }, [propStartDate, propEndDate]);
  
  // Fetch visitor cohort data
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchVisitorCohortData = async () => {
      if (!currentSite || currentSite.id === "default") {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setHasError(false);
      
      try {
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        params.append("startDate", startDate.toISOString());
        params.append("endDate", endDate.toISOString());
        if (segmentId && segmentId !== "all") {
          params.append("segmentId", segmentId);
        }
        

        
        const response = await fetch(`/api/visitor-cohorts?${params.toString()}`, {
          signal: abortController.signal
        });
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data: VisitorCohortResponse = await response.json();
        
        // More lenient validation - ensure the response structure is correct
        const visitorCohorts = data.visitorCohorts || [];
        
        // Validate that we have the expected structure
        if (!Array.isArray(visitorCohorts)) {
          setHasError(true);
          setVisitorCohortData([]);
          return;
        }
        
        // Set the data even if array is empty - the component will handle empty states
        setVisitorCohortData(visitorCohorts);
      } catch (error) {
        // Don't show error if request was just cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        setHasError(true);
        setVisitorCohortData([]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchVisitorCohortData();
    
    // Cleanup function to cancel the request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [segmentId, startDate, endDate, currentSite, user]);
  
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Visitor Retention by Week</h3>
          <div className="rounded-md border overflow-hidden">
            <div className="animate-pulse bg-card">
              {/* Table header */}
              <div className="flex border-b">
                <div className="py-3 px-4 bg-gray-100 dark:bg-gray-800 w-24">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="py-3 px-4 bg-gray-100 dark:bg-gray-800 flex-1 text-center">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto w-14"></div>
                  </div>
                ))}
              </div>
              
              {/* Data rows */}
              {Array.from({ length: 7 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex border-b last:border-0">
                  <div className="py-3 px-4 w-24">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </div>
                  {Array.from({ length: 8 }).map((_, cellIndex) => {
                    // Early cells have data, later ones don't (based on row)
                    const hasCellData = cellIndex < (8 - rowIndex);
                    return (
                      <div key={cellIndex} className="py-3 px-4 flex-1 text-center">
                        {hasCellData && (
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto w-8" 
                               style={{opacity: Math.max(0.2, 1 - (cellIndex * 0.1))}}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (hasError) {
    return (
      <EmptyCard 
        icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
        title="Error loading visitor cohort data"
        description="There was an error loading the visitor retention data. Please try again."
      />
    );
  }

  // If no data at all, show empty state
  if (visitorCohortData.length === 0) {
    return (
      <EmptyCard 
        icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
        title="No visitor cohort data available"
        description="There is no visitor retention data available for the selected period."
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Visitor Cohort Table */}
      <div>
        <h3 className="text-lg font-medium mb-4">Visitor Retention by Week</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cohort</TableHead>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableHead key={i} className="text-center">Week {i + 1}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...visitorCohortData].reverse().map((row, rowIndex) => {
                return (
                  <TableRow key={row.cohort}>
                    <TableCell className="font-medium">{row.cohort}</TableCell>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const value = row.weeks[i];
                      const cellContent = value !== undefined && value !== null ? `${value}%` : '';
                      const cellStyle = { 
                        background: value > 0 ? getGradientBackground(value, isDarkMode) : 'transparent',
                        color: value > 0 ? 'white' : undefined,
                        textShadow: value > 0 ? '0px 0px 2px rgba(0, 0, 0, 0.3)' : undefined
                      };
                      
                      return (
                        <TableCell 
                          key={i} 
                          className="text-center"
                          style={cellStyle}
                        >
                          {cellContent}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
} 