"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useSite } from "@/app/context/SiteContext";
import { Badge } from "@/app/components/ui/badge";
import { EmptyCard } from "@/app/components/ui/empty-card";
import { ClipboardList, Circle } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { format } from "date-fns";
import { useRequestController } from "@/app/hooks/useRequestController";

interface ActivityUser {
  id: string;
  name: string;
  email: string;
  imageUrl?: string | null;
}

interface Lead {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  user: ActivityUser;
  action: string;
  date: string;
  lead: Lead;
  segment?: string | null;
  title: string;
  status?: string;
  campaign?: string;
}

interface RecentActivityProps {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

// Función auxiliar para obtener iniciales
function getInitials(name: string | undefined | null): string {
  if (!name) return 'U';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

// Función para formatear fechas
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    // For dates older than 24 hours but in the current year
    if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'MMM d');
    }
    
    // For dates in previous years
    return format(date, 'MMM d, yyyy');
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'Unknown date';
  }
}

export function RecentActivity({ 
  limit = 5,
  startDate,
  endDate
}: RecentActivityProps) {
  const { currentSite } = useSite();
  const { fetchWithController, getSignalForEndpoint } = useRequestController();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add loading placeholder state
  const emptyActivities = Array(limit).fill(null).map((_, i) => ({ 
    id: `placeholder-${i}`, 
    user: { name: 'Loading...', email: 'loading@example.com' },
    type: 'placeholder',
    date: new Date().toISOString()
  }));

  useEffect(() => {
    let isMounted = true;
    
    async function fetchActivities() {
      // Debug logs - Current site
      console.group("Recent Activity - Debug Info");
      console.log("Current Site:", currentSite);
      console.log("Current Site ID:", currentSite?.id);
      console.log("Is currentSite loaded:", !!currentSite);
      console.log("Is currentSite.id valid:", currentSite?.id !== "default" && !!currentSite?.id);
      console.groupEnd();

      if (!currentSite?.id || currentSite.id === "default") {
        console.warn("Recent Activity: No valid site ID available");
        if (isMounted) {
          setActivities([]);
          setIsLoading(false);
        }
        return;
      }
      
      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }
      
      try {
        // Validate that we're only requesting with valid data
        if (!currentSite.id || typeof currentSite.id !== 'string') {
          console.error('Invalid site ID for recent activities request');
          throw new Error('Invalid site ID');
        }
        
        // Ensure limit is a valid number
        const validLimit = typeof limit === 'number' && limit > 0 ? limit : 6;
        
        console.time("Recent Activity API Request");
        const queryParams = new URLSearchParams();
        queryParams.append('siteId', currentSite.id);
        queryParams.append('limit', validLimit.toString());
        
        // Add date range params if provided
        if (startDate) {
          queryParams.append('startDate', format(startDate, 'yyyy-MM-dd'));
        }
        if (endDate) {
          queryParams.append('endDate', format(endDate, 'yyyy-MM-dd'));
        }
        
        const apiUrl = `/api/recent-activity?${queryParams.toString()}`;
        console.log("Requesting recent activities from:", apiUrl);
        
        // Use the request controller instead of a local AbortController
        const response = await fetchWithController(apiUrl);
        
        // If request was aborted or component unmounted
        if (response === null || !isMounted) {
          console.log("[RecentActivity] Request was cancelled or component unmounted");
          return;
        }
        
        console.log("API response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        // Get the response JSON
        const data = await response.json();
        console.log("API returned activities count:", data.activities?.length || 0);
        
        if (isMounted) {
          setActivities(data.activities || []);
        }
        
        console.timeEnd("Recent Activity API Request");
      } catch (error) {
        // Don't handle AbortError explicitly as it's handled in fetchWithController
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log("[RecentActivity] Request was aborted");
          return;
        }
        
        console.error('Error fetching activities:', error);
        
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Unknown error occurred');
          // Use fallback data when API fails after retries
          setActivities([
            {
              id: "fallback-1",
              user: { 
                id: "system", 
                name: "System", 
                email: "system@example.com",
                imageUrl: null 
              },
              date: new Date().toISOString(),
              lead: { id: "unknown", name: "Unknown" },
              title: "Recent activity temporarily unavailable",
              action: "System notice"
            }
          ]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    
    fetchActivities();
    
    // Clean up function to handle component unmount
    return () => {
      isMounted = false;
    };
  }, [currentSite?.id, limit, startDate, endDate, fetchWithController, getSignalForEndpoint]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        {emptyActivities.map((activity) => (
          <div key={activity.id} className="flex items-center">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="ml-4 space-y-1">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-3 w-[200px]" />
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              <Skeleton className="h-3 w-[60px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center py-8">
        <EmptyCard
          icon={<ClipboardList className="h-10 w-10 text-muted-foreground" />}
          title="Error loading activities"
          description={error}
          showShadow={false}
          contentClassName="py-12"
        />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="h-full flex items-center justify-center py-6">
        <EmptyCard
          icon={<ClipboardList className="h-6 w-6 text-muted-foreground" />}
          title="No recent activity"
          description="When leads complete tasks, they will appear here."
          showShadow={false}
          contentClassName="py-12"
          className="flex-1 flex flex-col items-center justify-center"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center">
          <Avatar>
            <AvatarImage src={activity.user.imageUrl ?? ""} alt={activity.user.name || ""} />
            <AvatarFallback>{getInitials(activity.user.name || activity.lead?.name || "")}</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{activity.user.name}</p>
            <p className="text-sm text-muted-foreground">
              {activity.action || activity.title || "Performed an action"} 
              {activity.segment && 
                <span> on <span className="font-medium">{activity.segment}</span></span>
              }
              {activity.campaign && 
                <span> in <span className="font-medium">{activity.campaign}</span></span>
              }
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <span title={new Date(activity.date).toLocaleString()}>
              {formatDate(activity.date)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
} 