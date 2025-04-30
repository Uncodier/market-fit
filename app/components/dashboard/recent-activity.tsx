"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useSite } from "@/app/context/SiteContext";
import { Badge } from "@/app/components/ui/badge";
import { EmptyCard } from "@/app/components/ui/empty-card";
import { ClipboardList } from "@/app/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";

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
}

// Función auxiliar para obtener iniciales
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
    .substring(0, 2);
}

// Función para formatear fechas
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

export function RecentActivity() {
  const { currentSite } = useSite();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        setActivities([]);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        console.time("Recent Activity API Request");
        const queryParams = new URLSearchParams();
        queryParams.append('siteId', currentSite.id);
        queryParams.append('limit', '6'); // Limitado a 6 actividades
        
        const apiUrl = `/api/recent-activity?${queryParams.toString()}`;
        console.log("Requesting recent activities from:", apiUrl);
        
        const response = await fetch(apiUrl);
        console.log("API response status:", response.status);
        
        const responseText = await response.text();
        console.log("Raw API response:", responseText);
        
        // Try to parse the response as JSON
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error("Failed to parse API response as JSON:", parseError);
          throw new Error("Invalid response format");
        }
        
        if (!response.ok) {
          const errorMsg = data.error || `API error: ${response.status}`;
          console.error("API error:", errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log("API returned activities:", data.activities);
        console.log("Activities count:", data.activities?.length || 0);
        
        setActivities(data.activities || []);
        console.timeEnd("Recent Activity API Request");
      } catch (error) {
        console.error('Error fetching activities:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchActivities();
  }, [currentSite?.id]);

  if (isLoading) {
    return (
      <div className="space-y-4 min-h-[200px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="flex items-start gap-2 h-[44px]" key={i}>
            <Skeleton className="h-8 w-8 mt-0.5 rounded-full" />
            <div className="ml-0 space-y-1 flex-1">
              <div className="flex gap-2 items-center mb-0.5">
                <Skeleton className="h-3.5 w-20" />
                {Math.random() > 0.7 && <Skeleton className="h-3.5 w-12 rounded-full" />}
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-3 w-14 ml-auto mt-1" />
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
    <div className="space-y-4">
      {activities.map((activity) => (
        <div className="flex items-start gap-2" key={activity.id}>
          <Avatar className="h-8 w-8 mt-0.5">
            {activity.user.imageUrl && (
              <AvatarImage src={activity.user.imageUrl} alt={activity.user.name} />
            )}
            <AvatarFallback>
              {getInitials(activity.user.name || activity.lead.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs font-medium truncate max-w-[90px]">
                      {activity.user.name}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {activity.user.name}
                  </TooltipContent>
                </Tooltip>
                {activity.segment && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {activity.segment}
                  </Badge>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-medium">{activity.title}</span> 
                    <span className="text-muted-foreground/70"> • </span>
                    <span className="text-green-500 font-medium text-[10px]">completed</span>
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {activity.title} - completed task
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDate(activity.date)}
          </div>
        </div>
      ))}
    </div>
  );
} 