"use client"

import { useId, useState } from "react"
import { format, parseISO } from "date-fns"
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { TooltipProps } from "recharts"
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Activity } from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import type { SocialTrendMetric, SocialTrendPoint, SocialTrendsData } from "./social-trends"

const metrics: { value: SocialTrendMetric; label: string }[] = [
  { value: "views", label: "Views" },
  { value: "reach", label: "Reach" },
  { value: "engagement", label: "Engagement Rate" },
  { value: "comments", label: "Comments" },
  { value: "likes", label: "Likes" },
  { value: "shares", label: "Shares" },
]

const countFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

function formatMetric(value: number | null, metric: SocialTrendMetric) {
  if (value == null) return "—"
  return metric === "engagement" ? `${value.toFixed(2)}%` : countFormatter.format(value)
}

function formatRange(start: string, end: string) {
  const first = format(parseISO(start), "MMM d, yyyy")
  return start === end ? first : `${first} – ${format(parseISO(end), "MMM d, yyyy")}`
}

function comparisonLabel(data: SocialTrendsData, metric: SocialTrendMetric) {
  if (!data.current.postCount || !data.previous.postCount) return "No posts to compare"
  const current = data.current[metric] ?? 0
  const previous = data.previous[metric] ?? 0
  const difference = current - previous
  if (metric === "engagement") return `${difference > 0 ? "+" : ""}${difference.toFixed(2)} pp vs. previous period`
  if (previous === 0) return current === 0 ? "No change vs. previous period" : "No previous baseline"
  const change = difference / previous * 100
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs. previous period`
}

function TrendTooltip({ active, payload, metric }: TooltipProps<number, string> & { metric: SocialTrendMetric }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as SocialTrendPoint
  return (
    <div className="rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md">
      {(["current", "previous"] as const).map((period) => (
        <div key={period} className={period === "previous" ? "mt-3 border-t pt-3" : ""}>
          <p className="font-medium">{period === "current" ? "Selected period" : "Previous period"}</p>
          <p className="text-xs text-muted-foreground">
            {formatRange(period === "current" ? point.date : point.previousDate, period === "current" ? point.endDate : point.previousEndDate)}
          </p>
          <p className="mt-1 font-semibold tabular-nums">{formatMetric(point[period][metric], metric)}</p>
          <p className="text-xs text-muted-foreground">{countFormatter.format(point[period].postCount)} posts</p>
        </div>
      ))}
    </div>
  )
}

interface SocialTrendsChartProps {
  data?: SocialTrendsData
  isLoading?: boolean
  error?: boolean
}

export function SocialTrendsChart({ data, isLoading = false, error = false }: SocialTrendsChartProps) {
  const [metric, setMetric] = useState<SocialTrendMetric>("views")
  const { isDarkMode } = useTheme()
  const gradientId = `social-trend-${useId().replace(/:/g, "")}`
  const metricLabel = metrics.find((item) => item.value === metric)!.label
  const hasPosts = !!data && data.current.postCount + data.previous.postCount > 0
  const currentColor = isDarkMode ? "#60a5fa" : "#2563eb"
  const previousColor = isDarkMode ? "#a1a1aa" : "#71717a"
  const first = data?.points[0]
  const last = data?.points[data.points.length - 1]

  return (
    <Card className="min-w-0" aria-label="Social performance trends" aria-busy={isLoading}>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Performance trends</CardTitle>
          <CardDescription>Compare post performance with the previous period of the same length.</CardDescription>
        </div>
        <Select value={metric} onValueChange={(value) => setMetric(value as SocialTrendMetric)} disabled={isLoading || error}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Trend metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metrics.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div role="status" aria-label="Loading performance trends" className="space-y-5">
            <Skeleton className="h-14 w-64 max-w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : error ? (
          <div role="alert">
            <EmptyCard title="Unable to load performance trends" description="Please try again later." variant="simple" showShadow={false} />
          </div>
        ) : !hasPosts || !data || !first || !last ? (
          <EmptyCard
            icon={<Activity className="h-8 w-8" />}
            title="No post performance data"
            description="There are no post metrics for the selected or previous period. Try a different date range."
            variant="simple"
            showShadow={false}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Selected period · {metricLabel}</p>
                <p className="text-2xl font-bold tabular-nums">{formatMetric(data.current[metric], metric)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previous period · {metricLabel}</p>
                <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{formatMetric(data.previous[metric], metric)}</p>
              </div>
              <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">{comparisonLabel(data, metric)}</p>
            </div>
            <div className="h-[300px] w-full" role="img" aria-label={`${metricLabel} by publication period, compared with the previous period`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.points} margin={{ top: 10, right: 12, left: 0, bottom: 5 }} accessibilityLayer>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={currentColor} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={currentColor} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e5e7eb"} />
                  <XAxis
                    dataKey="date" axisLine={false} tickLine={false} minTickGap={28} tickMargin={10}
                    tick={{ fontSize: 12, fill: previousColor }}
                    tickFormatter={(value: string) => format(parseISO(value), "MMM d")}
                  />
                  <YAxis
                    axisLine={false} tickLine={false} width={58} domain={[0, "auto"]} allowDecimals={metric === "engagement"}
                    tick={{ fontSize: 12, fill: previousColor }}
                    tickFormatter={(value: number) => metric === "engagement" ? `${Number(value.toFixed(2))}%` : compactFormatter.format(value)}
                  />
                  <Tooltip content={<TrendTooltip metric={metric} />} />
                  <Area
                    type="linear" dataKey={`current.${metric}`} name="Selected period" stroke={currentColor}
                    strokeWidth={2.5} fill={`url(#${gradientId})`} dot={{ r: 3, fill: currentColor, strokeWidth: 0 }}
                    activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false}
                  />
                  {data.previous.postCount > 0 && (
                    <Line
                      type="linear" dataKey={`previous.${metric}`} name="Previous period" stroke={previousColor}
                      strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2, fill: previousColor, strokeWidth: 0 }}
                      activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 shrink-0" style={{ backgroundColor: currentColor }} aria-hidden="true" />
                Selected: {formatRange(first.date, last.endDate)} · {countFormatter.format(data.current.postCount)} posts
              </span>
              <span className="flex items-center gap-2">
                <span className="w-5 shrink-0 border-t-2 border-dashed" style={{ borderColor: previousColor }} aria-hidden="true" />
                Previous: {formatRange(first.previousDate, last.previousEndDate)} · {countFormatter.format(data.previous.postCount)} posts
              </span>
            </div>
            <div className="space-y-1 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                Latest accumulated metrics grouped by publication date, not activity recorded on each day. Historical snapshots are not available.
                {metric === "engagement" ? " Engagement is the average rate per post; empty periods have no rate." : " Periods without posts show zero."}
                {` Grouped ${data.bucketDays === 1 ? "daily" : `every ${data.bucketDays} days`}.`}
              </p>
              {data.undatedPostCount > 0 && (
                <p>{countFormatter.format(data.undatedPostCount)} posts have no publication date and use their latest sync date instead.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}