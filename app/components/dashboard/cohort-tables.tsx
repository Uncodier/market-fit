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

interface CohortTablesProps {
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Types for our cohort data
interface CohortData {
  cohort: string
  weeks: number[]
}

interface CohortResponse {
  salesCohorts: CohortData[];
  usageCohorts: CohortData[];
}

// Calculate color intensity based on value
function getColorIntensity(value: number, isDarkMode: boolean) {
  // Base colors
  const baseColor = isDarkMode ? [129, 140, 248] : [99, 102, 241]; // indigo-400 : indigo-500
  
  // Calculate opacity based on value (higher value = more intense color)
  const opacity = Math.max(0.1, value / 100);
  
  return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${opacity})`;
}

// Function to create gradient backgrounds for cohort cells
function getGradientBackground(value: number, isDarkMode: boolean) {
  // Base colors - from lighter to darker indigo
  const baseLight = isDarkMode ? [165, 180, 252] : [129, 140, 248]; // indigo-300 or indigo-400
  const baseDark = isDarkMode ? [99, 102, 241] : [79, 70, 229]; // indigo-500 or indigo-600
  
  // Calculate opacity based on value (higher value = more intense color)
  const opacity = Math.max(0.1, value / 100);
  
  // Enhanced gradient with subtle effect
  return `linear-gradient(135deg, 
    rgba(${baseLight[0]}, ${baseLight[1]}, ${baseLight[2]}, ${opacity}) 0%, 
    rgba(${baseLight[0] - 10}, ${baseLight[1] - 10}, ${baseLight[2]}, ${opacity}) 30%,
    rgba(${baseDark[0]}, ${baseDark[1]}, ${baseDark[2]}, ${opacity}) 100%)`;
}

export function CohortTables({ segmentId = "all", startDate: propStartDate, endDate: propEndDate }: CohortTablesProps) {
  const { isDarkMode } = useTheme();
  const { currentSite } = useSite();
  const { user } = useAuth();
  const [salesCohortData, setSalesCohortData] = useState<CohortData[]>([]);
  const [usageCohortData, setUsageCohortData] = useState<CohortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [startDate, setStartDate] = useState<Date>(propStartDate || subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date>(propEndDate || new Date())
  
  // Update local state when props change
  useEffect(() => {
    if (propStartDate) {
      setStartDate(propStartDate);
    }
    if (propEndDate) {
      setEndDate(propEndDate);
    }
  }, [propStartDate, propEndDate]);
  
  // Fetch cohort data
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchCohortData = async () => {
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
        
        console.log(`[CohortTables] Fetching data with params:`, Object.fromEntries(params.entries()));
        
        const response = await fetch(`/api/cohorts?${params.toString()}`, {
          signal: abortController.signal
        });
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          console.log("[CohortTables] Request was cancelled");
          return;
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[CohortTables] API error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data: CohortResponse = await response.json();
        console.log(`[CohortTables] Received data:`, data);
        
        // More lenient validation - ensure the response structure is correct
        const salesCohorts = data.salesCohorts || [];
        const usageCohorts = data.usageCohorts || [];
        
        // Validate that we have the expected structure
        if (!Array.isArray(salesCohorts) || !Array.isArray(usageCohorts)) {
          console.error("[CohortTables] Invalid cohort data structure in response", data);
          setHasError(true);
          setSalesCohortData([]);
          setUsageCohortData([]);
          return;
        }
        
        // Set the data even if arrays are empty - the component will handle empty states
        setSalesCohortData(salesCohorts);
        setUsageCohortData(usageCohorts);
        
        // Log if we have no data for debugging
        if (salesCohorts.length === 0 && usageCohorts.length === 0) {
          console.log("[CohortTables] No cohort data available for the selected period");
        } else {
          console.log(`[CohortTables] Loaded ${salesCohorts.length} sales cohorts and ${usageCohorts.length} usage cohorts`);
        }
      } catch (error) {
        // Don't show error if request was just cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          console.log("[CohortTables] Request was cancelled");
          return;
        }
        
        console.error("Error fetching cohort data:", error);
        setHasError(true);
        setSalesCohortData([]);
        setUsageCohortData([]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchCohortData();
    
    // Cleanup function to cancel the request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [segmentId, startDate, endDate, currentSite, user]);
  
  if (isLoading) {
    return (
      <div className="space-y-8">
        {[0, 1].map((tableIndex) => (
          <div key={tableIndex}>
            <h3 className="text-lg font-medium mb-4">{tableIndex === 0 ? 'Sales' : 'Usage'} Retention by Week</h3>
            <div className="rounded-md border overflow-hidden">
              <div className="animate-pulse bg-card">
                {/* Encabezado de la tabla */}
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
                
                {/* Filas de datos */}
                {Array.from({ length: 7 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex border-b last:border-0">
                    <div className="py-3 px-4 w-24">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    </div>
                    {Array.from({ length: 8 }).map((_, cellIndex) => {
                      // Las primeras celdas tienen datos, las últimas no (basado en la fila)
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
        ))}
      </div>
    );
  }
  
  if (hasError) {
    return (
      <EmptyCard 
        icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
        title="Error loading cohort data"
        description="There was an error loading the retention data. Please try again."
      />
    );
  }

  // If no data at all, show empty state
  if (salesCohortData.length === 0 && usageCohortData.length === 0) {
    return (
      <EmptyCard 
        icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
        title="No cohort data available"
        description="There is no retention data available for the selected period."
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Sales Cohort Table - Only show if we have sales data */}
      {salesCohortData.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Sales Retention by Week</h3>
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
                {salesCohortData.map((row) => (
                  <TableRow key={row.cohort}>
                    <TableCell className="font-medium">{row.cohort}</TableCell>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const value = row.weeks[i] || 0;
                      return (
                        <TableCell 
                          key={i} 
                          className="text-center"
                          style={{ 
                            background: value > 0 ? getGradientBackground(value, isDarkMode) : 'transparent',
                            color: value > 0 ? 'white' : undefined,
                            textShadow: value > 0 ? '0px 0px 2px rgba(0, 0, 0, 0.3)' : undefined,
                            borderRadius: value > 0 ? '0.2rem' : undefined
                          }}
                        >
                          {value > 0 ? `${value}%` : ''}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {/* Usage Cohort Table - Only show if we have usage data */}
      {usageCohortData.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Usage Retention by Week</h3>
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
                {usageCohortData.map((row) => (
                  <TableRow key={row.cohort}>
                    <TableCell className="font-medium">{row.cohort}</TableCell>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const value = row.weeks[i] || 0;
                      return (
                        <TableCell 
                          key={i} 
                          className="text-center"
                          style={{ 
                            background: value > 0 ? getGradientBackground(value, isDarkMode) : 'transparent',
                            color: value > 0 ? 'white' : undefined,
                            textShadow: value > 0 ? '0px 0px 2px rgba(0, 0, 0, 0.3)' : undefined,
                            borderRadius: value > 0 ? '0.2rem' : undefined
                          }}
                        >
                          {value > 0 ? `${value}%` : ''}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Show message if we only have partial data */}
      {salesCohortData.length === 0 && usageCohortData.length > 0 && (
        <div className="text-sm text-muted-foreground text-center p-4 bg-muted/50 rounded-md">
          Only usage retention data is available for the selected period.
        </div>
      )}
      
      {usageCohortData.length === 0 && salesCohortData.length > 0 && (
        <div className="text-sm text-muted-foreground text-center p-4 bg-muted/50 rounded-md">
          Only sales retention data is available for the selected period.
        </div>
      )}
    </div>
  )
} 