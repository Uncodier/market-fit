"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { EmptyCard } from "@/app/components/ui/empty-card";
import { ClipboardList, ShoppingCart } from "@/app/components/ui/icons";
import { format } from "date-fns";
import { fetchWithRetry } from "@/app/utils/fetch-with-retry";
import { useRouter } from "next/navigation";
import type { Activity } from "@/app/api/recent-activity/format";

interface RecentActivityProps {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(dateString: string, t: (key: string) => string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return t("dashboard.recent.justNow") || "Just now";
    if (diffMins < 60) {
      return (t("dashboard.recent.minutesAgo") || "{n}m ago").replace("{n}", String(diffMins));
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return (t("dashboard.recent.hoursAgo") || "{n}h ago").replace("{n}", String(diffHours));
    }

    if (date.getFullYear() === now.getFullYear()) {
      return format(date, "MMM d");
    }
    return format(date, "MMM d, yyyy");
  } catch (e) {
    console.error("Error formatting date:", e);
    return "Unknown date";
  }
}

function saleHeadline(
  activity: Activity,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const customer = activity.lead?.name || activity.user?.name || t("dashboard.recent.aCustomer");
  if (activity.campaign && activity.amount) {
    return t("dashboard.recent.campaignSold", {
      campaign: activity.campaign,
      amount: activity.amount,
    });
  }
  return t("dashboard.recent.customerBought", {
    customer,
    products: activity.products || activity.amount || "",
  });
}

function saleDescription(
  activity: Activity,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  const customer = activity.lead?.name || activity.user?.name || t("dashboard.recent.aCustomer");
  if (activity.campaign) {
    if (activity.products) {
      return t("dashboard.recent.customerBought", {
        customer,
        products: activity.products,
      });
    }
    return customer;
  }
  if (activity.amount && activity.source) {
    return t("dashboard.recent.saleAmountSource", {
      amount: activity.amount,
      source: activity.source,
    });
  }
  return activity.amount || activity.description || null;
}

function taskHeadline(
  activity: Activity,
  t: (key: string) => string,
): string {
  const action =
    activity.action || activity.title || t("dashboard.recent.performedAction") || "Performed an action";
  let text = `${activity.user.name} | ${action}`;
  if (activity.segment) text += ` on ${activity.segment}`;
  if (activity.campaign) text += ` in ${activity.campaign}`;
  return text;
}

export function RecentActivity({
  limit = 6,
  startDate,
  endDate,
}: RecentActivityProps) {
  const { t } = useLocalization();
  const { currentSite } = useSite();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const emptyActivities = Array(limit).fill(null).map((_, i) => ({
    id: `placeholder-${i}`,
  }));

  useEffect(() => {
    let isMounted = true;

    async function fetchActivities() {
      if (!currentSite?.id || currentSite.id === "default") {
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
        const validLimit = typeof limit === "number" && limit > 0 ? limit : 6;
        const queryParams = new URLSearchParams();
        queryParams.append("siteId", currentSite.id);
        queryParams.append("limit", validLimit.toString());
        queryParams.append("useDemoData", "true");

        if (startDate) {
          queryParams.append("startDate", format(startDate, "yyyy-MM-dd"));
        }
        if (endDate) {
          queryParams.append("endDate", format(endDate, "yyyy-MM-dd"));
        }

        const response = await fetchWithRetry(
          fetch,
          `/api/recent-activity?${queryParams.toString()}`,
          { maxRetries: 3 },
        );

        if (!response || !isMounted) return;

        const data = await response.json();
        if (isMounted) {
          setActivities(data.activities || []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        console.error("Error fetching activities:", err);

        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error occurred");
          setActivities([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchActivities();

    return () => {
      isMounted = false;
    };
  }, [currentSite?.id, limit, startDate, endDate]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {emptyActivities.map((activity) => (
          <div key={activity.id} className="flex items-center rounded-lg p-2 -m-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="ml-4 space-y-1 flex-1 pr-4">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-3 w-[200px]" />
            </div>
            <div className="ml-auto">
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
          title={t("dashboard.recent.errorLoading") || "Error loading activities"}
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
          title={t("dashboard.recent.noActivity") || "No recent activity"}
          description={
            t("dashboard.recent.noActivityDesc") ||
            "Sales and completed tasks will appear here."
          }
          showShadow={false}
          contentClassName="py-12"
          className="flex-1 flex flex-col items-center justify-center"
        />
      </div>
    );
  }

  const handleActivityClick = (activity: Activity) => {
    if (activity.href) router.push(activity.href);
  };

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const isSale = activity.kind === "sale";
        const headline = isSale ? saleHeadline(activity, t) : taskHeadline(activity, t);
        const description = isSale ? saleDescription(activity, t) : activity.description;

        return (
          <div
            key={activity.id}
            className="flex items-center cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
            onClick={() => handleActivityClick(activity)}
          >
            <Avatar>
              <AvatarImage src={activity.user.imageUrl ?? ""} alt={activity.user.name || ""} />
              <AvatarFallback>
                {isSale ? (
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                ) : (
                  getInitials(activity.user.name || activity.lead?.name || "")
                )}
              </AvatarFallback>
            </Avatar>
            <div className="ml-4 space-y-1 flex-1 pr-4">
              <p className="text-sm font-medium text-foreground leading-snug line-clamp-1 overflow-hidden">
                {headline}
              </p>
              {description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 overflow-hidden">
                  {description}
                </p>
              )}
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              <span title={new Date(activity.date).toLocaleString()}>
                {formatDate(activity.date, t)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
