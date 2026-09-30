import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"

/** Keep the same panel tracks while modules, requests and retries settle. */
export function OverviewActivityLayout({ chart, activity, action, activityTitle = "Recent commercial activity", loading = false }: {
  chart: ReactNode
  activity: ReactNode
  action?: ReactNode
  activityTitle?: string
  loading?: boolean
}) {
  return <div aria-label="Activity analysis" className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:[&>*]:row-span-2 xl:[&>*]:grid xl:[&>*]:grid-rows-subgrid xl:[&>*]:gap-y-0">
    <Card className="min-w-0 shadow-none" data-report-panel="activity-trend" data-loading-panel={loading ? "chart" : undefined}>
      <CardHeader className="flex flex-col justify-between gap-4 space-y-0 pb-3 sm:flex-row sm:items-start">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-base">Activity over time</CardTitle>
          <CardDescription>Recorded engagement, meetings and sales by day in UTC.</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:self-center">
          {action ?? <><Skeleton className="h-6 w-11 rounded-full" /><span className="text-sm font-medium text-muted-foreground">Show Conversations</span></>}
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="h-[300px] min-w-0 sm:h-[360px] xl:relative xl:h-full xl:min-h-[360px]" data-activity-chart-frame>
          <div className="h-full min-w-0 xl:absolute xl:inset-0 [&>*]:h-full">{chart}</div>
        </div>
      </CardContent>
    </Card>
    <Card className="min-w-0 shadow-none" data-report-panel="recent-activity" data-loading-panel={loading ? "list" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{activityTitle}</CardTitle>
        <CardDescription>Latest records across all segments.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">{activity}</CardContent>
    </Card>
  </div>
}