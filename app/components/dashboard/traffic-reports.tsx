"use client";

import React, { useState, useEffect } from "react";
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
  const { user } = useAuth();
  
  const [trafficData, setTrafficData] = useState<TrafficData>({
    pages: [],
    referrals: [],
    regions: [],
    devices: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const fetchAllTrafficData = async () => {
      if (!shouldExecuteWidgets || !currentSite || currentSite.id === "default" || !startDate || !endDate) {
        setIsLoading(false);
        setDataLoaded(true);
        return;
      }

      setIsLoading(true);
      setError(null);
      setDataLoaded(false);

      try {
        const start = format(startDate, "yyyy-MM-dd");
        const end = format(endDate, "yyyy-MM-dd");

        const baseParams = new URLSearchParams();
        baseParams.append("siteId", currentSite.id);
        if (user?.id) {
          baseParams.append("userId", user.id);
        }
        baseParams.append("startDate", start);
        baseParams.append("endDate", end);
        if (segmentId && segmentId !== "all") {
          baseParams.append("segmentId", segmentId);
        }

        console.log("[TrafficReports] Fetching COMBINED traffic data to prevent individual calls:", baseParams.toString());

        // Make single combined call instead of multiple individual calls
        const endpoints = ['pages', 'referrals', 'regions', 'devices'];
        
        // Fetch all data sequentially with small delays to prevent overload
        const results = [];
        for (let i = 0; i < endpoints.length; i++) {
          const endpoint = endpoints[i];
          try {
            console.log(`[TrafficReports] Fetching ${endpoint} data...`);
            const response = await fetchWithController(`/api/traffic/${endpoint}?${baseParams.toString()}`);
            
            if (response === null) {
              results.push({ endpoint, data: [] });
              continue;
            }
            if (!response.ok) {
              throw new Error(`Failed to fetch ${endpoint}`);
            }
            const result = await response.json();
            results.push({ endpoint, data: result.data || [] });
            
            // Small delay between calls
            if (i < endpoints.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            results.push({ endpoint, data: [] });
          }
        }

        const newTrafficData: TrafficData = {
          pages: [],
          referrals: [],
          regions: [],
          devices: []
        };

        results.forEach((result: any) => {
          newTrafficData[result.endpoint as keyof TrafficData] = result.data;
        });

        setTrafficData(newTrafficData);
        setDataLoaded(true);
        console.log("[TrafficReports] All traffic data loaded successfully:", newTrafficData);
      } catch (error) {
        console.error("[TrafficReports] Error fetching traffic data:", error);
        setError(error instanceof Error ? error.message : 'Failed to fetch traffic data');
        setDataLoaded(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllTrafficData();
  }, [shouldExecuteWidgets, currentSite, user, startDate, endDate, segmentId, fetchWithController]);

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
            <CardTitle className="text-base">Traffic Sources</CardTitle>
            <CardDescription className="text-xs">
              Where your visitors come from
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TrafficPieChart
              endpoint="referrals"
              title="Traffic Sources"
              emptyText="No referral data available"
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              preloadedData={dataLoaded ? trafficData.referrals : undefined}
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