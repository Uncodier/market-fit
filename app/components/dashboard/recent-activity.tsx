"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { RecentActivityLoading } from "./recent-activity-loading";
import { useLocalization } from "@/app/context/LocalizationContext";
import { EmptyCard } from "@/app/components/ui/empty-card";
import { ClipboardList, ShoppingCart } from "@/app/components/ui/icons";
import { format } from "date-fns";
import { useRecentActivityReport } from "./use-recent-activity-report";
import { Button } from "@/app/components/ui/button";
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
  const router = useRouter();
  const { data, isLoading, error, mutate } = useRecentActivityReport(limit, startDate, endDate);
  const activities = data?.activities ?? [];

  if (isLoading) {
    return <RecentActivityLoading limit={limit} />;
  }

  if (error) {
    return (
      <div role="alert" className="h-full flex flex-col items-center justify-center py-8">
        <EmptyCard
          icon={<ClipboardList className="h-10 w-10 text-muted-foreground" />}
          title={t("dashboard.recent.errorLoading") || "Error loading activities"}
          description={error.message}
          showShadow={false}
          contentClassName="py-12"
        />
        <Button variant="outline" onClick={() => { void mutate(); }}>Retry recent activity</Button>
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
    <div className="grid min-w-0 gap-2">
      {activities.map((activity) => {
        const isSale = activity.kind === "sale";
        const headline = isSale ? saleHeadline(activity, t) : taskHeadline(activity, t);
        const description = isSale ? saleDescription(activity, t) : activity.description;

        return (
          <div
            key={activity.id}
            className="-mx-2 flex min-w-0 items-center gap-4 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors"
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
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground leading-5 line-clamp-1 overflow-hidden">
                {headline}
              </p>
              {description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 overflow-hidden">
                  {description}
                </p>
              )}
            </div>
            <div className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
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
