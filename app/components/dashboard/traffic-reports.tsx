"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { SessionsWidget } from "@/app/components/dashboard/traffic/visits-widget";
import { UniqueVisitorsWidget } from "@/app/components/dashboard/traffic/unique-visitors-widget";
import { SessionTimeWidget } from "@/app/components/dashboard/traffic/session-time-widget";
import { LeadConversionWidget } from "@/app/components/dashboard/traffic/lead-conversion-widget";
import { TrafficPieChart } from "@/app/components/dashboard/traffic/traffic-pie-chart";
import { SessionEventsContainer } from "@/app/components/dashboard/traffic/session-events-container";
import { useWidgetContext } from "@/app/context/WidgetContext";
import { useRequestController } from "@/app/hooks/useRequestController";
import { useSite } from "@/app/context/SiteContext";
import { useAuth } from "@/app/hooks/use-auth";
import { format } from "date-fns";
import { subDays } from "date-fns";

interface TrafficReportsProps {
  startDate?: Date;
  endDate?: Date;
  segmentId?: string;
  siteId: string;
}

interface TrafficData {
  pages: any[];
  referrals: any[];
  regions: any[];
  devices: any[];
  browsers: any[];
}

export function TrafficReports({ 
  startDate = subDays(new Date(), 30), 
  endDate = new Date(),
  segmentId = "all",
  siteId
}: TrafficReportsProps) {
  const { shouldExecuteWidgets } = useWidgetContext();
  const { fetchWithController } = useRequestController();
  const { currentSite } = useSite();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const [trafficData, setTrafficData] = useState<TrafficData>({
    pages: [],
    referrals: [],
    regions: [],
    devices: [],
    browsers: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Add retry counter to prevent infinite loops
  const retryCountRef = useRef(0);
  const maxRetries = 2;
  const lastParamsRef = useRef<string>("");

  useEffect(() => {
    let isMounted = true;
    
    const fetchAllTrafficData = async () => {
      // CRITICAL: Wait for authentication to complete before making API calls
      if (isAuthLoading) {
        console.log(`[TrafficReports] Waiting for authentication to complete...`);
        return;
      }
      
      if (!shouldExecuteWidgets || !currentSite || currentSite.id === "default" || !startDate || !endDate) {
        setIsLoading(false);
        setDataLoaded(true);
        return;
      }

      // If we don't have a valid user after auth is complete, show error
      if (!user || !user.id) {
        console.error(`[TrafficReports] No user or user ID available after authentication. user:`, user);
        setError("Authentication required - please log in to view traffic data");
        setIsLoading(false);
        setDataLoaded(true);
        return;
      }

      // CRITICAL: Validate dates to prevent future dates from being sent to API
      const now = new Date();
      const currentYear = now.getFullYear();
      
      // Create safe copies of dates
      let safeStartDate = new Date(startDate);
      let safeEndDate = new Date(endDate);
      
      // Log the original dates for debugging
      console.log(`[TrafficReports] Original dates - startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
      console.log(`[TrafficReports] Current date for comparison: ${now.toISOString()}`);
      
      // Detect and fix future years
      if (safeStartDate.getFullYear() > currentYear) {
        console.error(`[TrafficReports] Future year detected in startDate: ${safeStartDate.getFullYear()}, current year: ${currentYear}`);
        safeStartDate = subDays(now, 30); // Use 30 days ago as fallback
      }
      
      if (safeEndDate.getFullYear() > currentYear) {
        console.error(`[TrafficReports] Future year detected in endDate: ${safeEndDate.getFullYear()}, current year: ${currentYear}`);
        safeEndDate = now; // Use today as fallback
      }
      
      // Validate against future dates
      if (safeStartDate > now) {
        console.warn(`[TrafficReports] Start date is in the future: ${safeStartDate.toISOString()}, using 30 days ago`);
        safeStartDate = subDays(now, 30);
      }
      
      if (safeEndDate > now) {
        console.warn(`[TrafficReports] End date is in the future: ${safeEndDate.toISOString()}, using today`);
        safeEndDate = now;
      }
      
      // Ensure start date is before end date
      if (safeStartDate > safeEndDate) {
        console.warn(`[TrafficReports] Start date is after end date, correcting`);
        safeStartDate = subDays(safeEndDate, 30);
      }
      
      console.log(`[TrafficReports] Validated dates - startDate: ${safeStartDate.toISOString()}, endDate: ${safeEndDate.toISOString()}`);
      
      // Additional validation: Check and log the final dates that will be sent to API
      const startDateStr = format(safeStartDate, 'yyyy-MM-dd');
      const endDateStr = format(safeEndDate, 'yyyy-MM-dd');
      
      console.log(`[TrafficReports] Final safe dates for API - startDate: ${startDateStr}, endDate: ${endDateStr}`);
      
      // CRITICAL: Additional check to prevent any future years from being sent
      const currentYearStr = currentYear.toString();
      if (parseInt(startDateStr.split('-')[0]) > currentYear || parseInt(endDateStr.split('-')[0]) > currentYear) {
        console.error(`[TrafficReports] CRITICAL: Future year detected in final dates! startDate: ${startDateStr}, endDate: ${endDateStr}, current year: ${currentYear}`);
        console.error(`[TrafficReports] Stack trace:`, new Error().stack);
        // Force reset to safe values
        safeStartDate = subDays(now, 30);
        safeEndDate = now;
      }

      // Build API parameters with validated dates
      const buildParams = (endpoint: string) => {
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        params.append("userId", user.id);
        params.append("startDate", format(safeStartDate, 'yyyy-MM-dd'));
        params.append("endDate", format(safeEndDate, 'yyyy-MM-dd'));
        
        // Additional validation of the constructed URL - check for actual future years only
        const urlParams = params.toString();
        const urlStartYear = parseInt(urlParams.match(/startDate=(\d{4})/)?.[1] || '0');
        const urlEndYear = parseInt(urlParams.match(/endDate=(\d{4})/)?.[1] || '0');
        
        if (urlStartYear > currentYear || urlEndYear > currentYear) {
          console.error(`[TrafficReports] CRITICAL: Future year detected in URL params for ${endpoint}!`);
          console.error(`[TrafficReports] URL params: ${urlParams}`);
          console.error(`[TrafficReports] Start year: ${urlStartYear}, End year: ${urlEndYear}, Current year: ${currentYear}`);
          throw new Error(`Future year detected in API parameters: ${urlParams}`);
        }
        
        return urlParams;
      };

      // Add retry protection to prevent infinite loops
      const currentParams = JSON.stringify({ 
        siteId: currentSite.id, 
        userId: user.id, 
        startDate: format(safeStartDate, 'yyyy-MM-dd'), 
        endDate: format(safeEndDate, 'yyyy-MM-dd') 
      });
      
      if (currentParams === lastParamsRef.current) {
        retryCountRef.current++;
        console.log(`[TrafficReports] Retry attempt ${retryCountRef.current} for same parameters`);
        if (retryCountRef.current >= maxRetries) {
          console.error(`[TrafficReports] Max retries reached, aborting request`);
          setError("Max retries reached - please refresh the page");
          setIsLoading(false);
          setDataLoaded(true);
          return;
        }
      } else {
        retryCountRef.current = 0;
        lastParamsRef.current = currentParams;
      }

      console.log(`[TrafficReports] Fetching traffic data with params: ${currentParams}`);

      // Set loading state
      if (isMounted) {
        setIsLoading(true);
        setError(null);
        setDataLoaded(false);
      }

      try {
        // Define endpoints and fetch data
        const endpoints = ["pages", "referrals", "regions", "devices", "browsers"];
        const results = [];

        for (let i = 0; i < endpoints.length; i++) {
          const endpoint = endpoints[i];
          
          try {
            const urlParams = buildParams(endpoint);
            
            console.log(`[TrafficReports] Fetching ${endpoint} data...`);
            const response = await fetchWithController(`/api/traffic/${endpoint}?${urlParams}`);

            if (response === null) {
              console.log(`[TrafficReports] Request for ${endpoint} was aborted`);
              return;
            }

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[TrafficReports] Error fetching ${endpoint}: ${response.status} ${errorText}`);
              throw new Error(`Error ${response.status}: ${errorText}`);
            }

            const responseData = await response.json();
            console.log(`[TrafficReports] ${endpoint} data received:`, responseData);

            results.push({
              endpoint,
              data: responseData.data || []
            });

          } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            results.push({ endpoint, data: [] });
          }
        }

        const newTrafficData: TrafficData = {
          pages: [],
          referrals: [],
          regions: [],
          devices: [],
          browsers: []
        };

        results.forEach((result: any) => {
          newTrafficData[result.endpoint as keyof TrafficData] = result.data;
        });

        if (isMounted) {
          setTrafficData(newTrafficData);
          setDataLoaded(true);
          console.log("[TrafficReports] All traffic data loaded successfully:", newTrafficData);
        }
      } catch (error) {
        console.error("[TrafficReports] Error fetching traffic data:", error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Failed to fetch traffic data');
          setDataLoaded(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAllTrafficData();
    
    return () => {
      isMounted = false;
    };
  }, [shouldExecuteWidgets, currentSite, user, startDate, endDate, segmentId, fetchWithController, isAuthLoading]);

  // Show loading state while authentication is in progress
  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Widgets Row - First Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SessionsWidget
          startDate={startDate}
          endDate={endDate}
          segmentId={segmentId}
        />
        <UniqueVisitorsWidget
          startDate={startDate}
          endDate={endDate}
          segmentId={segmentId}
        />
        <SessionTimeWidget
          startDate={startDate}
          endDate={endDate}
          segmentId={segmentId}
        />
        <LeadConversionWidget
          startDate={startDate}
          endDate={endDate}
          segmentId={segmentId}
        />
      </div>
      
      {/* Pie Charts Section - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Visited Pages</CardTitle>
            <CardDescription className="text-xs">
              Most popular pages on your site
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TrafficPieChart
              endpoint="pages"
              title="Top Visited Pages"
              emptyText="No page data available"
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              // Force use of preloaded data
              preloadedData={dataLoaded ? trafficData.pages : undefined}
              isLoading={isLoading}
              error={error}
              skipApiCall={true}
            />
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Browsers</CardTitle>
            <CardDescription className="text-xs">
              Most popular browsers used to visit
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TrafficPieChart
              endpoint="browsers"
              title="Browsers"
              emptyText="No browser data available"
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              preloadedData={dataLoaded ? trafficData.browsers : undefined}
              isLoading={isLoading}
              error={error}
              skipApiCall={true}
            />
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geographic Regions</CardTitle>
            <CardDescription className="text-xs">
              Visitor locations by region
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TrafficPieChart
              endpoint="regions"
              title="Geographic Regions"
              emptyText="No region data available"
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              preloadedData={dataLoaded ? trafficData.regions : undefined}
              isLoading={isLoading}
              error={error}
              skipApiCall={true}
            />
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Device Types</CardTitle>
            <CardDescription className="text-xs">
              Types of devices used to visit
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TrafficPieChart
              endpoint="devices"
              title="Device Types"
              emptyText="No device data available"
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              preloadedData={dataLoaded ? trafficData.devices : undefined}
              isLoading={isLoading}
              error={error}
              skipApiCall={true}
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Page Visits Section - Third Row */}
      <SessionEventsContainer 
        siteId={siteId} 
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
} 