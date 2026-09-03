"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useSite } from "@/app/context/SiteContext"
import { getSocialPerformanceData } from "./social-actions"
import { Activity, Eye, MessageCircle, BarChart } from "@/app/components/ui/icons"
import { getNetworkIcon } from "@/app/content/content-shared"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"

interface SocialReportsProps {
  startDate: Date
  endDate: Date
  segmentId?: string
}

function formatEngagement(rate: number) {
  const n = Number(rate) || 0
  return new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 })
    .format(n > 1 ? n / 100 : n)
}

function KpiCard({ title, value, icon: Icon, isLoading }: { title: string; value?: React.ReactNode; icon: React.ComponentType<{ className?: string }>; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  )
}

export function SocialReports({ startDate, endDate }: SocialReportsProps) {
  const { currentSite } = useSite()
  const [data, setData] = useState<Awaited<ReturnType<typeof getSocialPerformanceData>> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentSite || currentSite.id === "default") {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    getSocialPerformanceData(currentSite.id, startDate, endDate).then((res) => {
      if (cancelled) return
      setData(res)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [currentSite, startDate, endDate])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Views" isLoading icon={Eye} />
          <KpiCard title="Reach" isLoading icon={BarChart} />
          <KpiCard title="Engagement Rate" isLoading icon={Activity} />
          <KpiCard title="Comments" isLoading icon={MessageCircle} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>By Network</CardTitle>
            <CardDescription>Performance breakdown across connected networks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Posts</CardTitle>
            <CardDescription>Social media posts ranked by engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Post</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Views</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Reach</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Engagement</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Likes</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3">
                        <Skeleton className="h-4 w-3/4 max-w-[200px]" />
                      </td>
                      <td className="py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                      <td className="py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                      <td className="py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                      <td className="py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const kpis = data?.kpis || { totalViews: 0, totalReach: 0, avgEngagementRate: 0, totalComments: 0 }
  const posts = data?.data || []
  const networks = data?.networks || []
  const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Views" value={numberFormatter.format(kpis.totalViews)} icon={Eye} />
        <KpiCard title="Reach" value={numberFormatter.format(kpis.totalReach)} icon={BarChart} />
        <KpiCard title="Engagement Rate" value={formatEngagement(kpis.avgEngagementRate)} icon={Activity} />
        <KpiCard title="Comments" value={numberFormatter.format(kpis.totalComments)} icon={MessageCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By Network</CardTitle>
          <CardDescription>Performance breakdown across connected networks</CardDescription>
        </CardHeader>
        <CardContent>
          {networks.length > 0 ? (
            <div className="space-y-3">
              {networks.map((network) => (
                <div key={network.network} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-2 capitalize">
                    {getNetworkIcon(network.network)}
                    <span className="text-sm font-medium">{network.network}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{numberFormatter.format(network.views)} views</span>
                    <span>{numberFormatter.format(network.reach)} reach</span>
                    <span>{numberFormatter.format(network.likes)} likes</span>
                    <span>{numberFormatter.format(network.comments)} comments</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCard
              icon={<Activity className="h-8 w-8" />}
              title="No network data"
              description="There is no performance data by network for this period."
              showShadow={false}
              variant="simple"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Posts</CardTitle>
          <CardDescription>Social media posts ranked by engagement</CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Post</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Views</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Reach</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Engagement</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Likes</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.slice(0, 10).map((post) => (
                    <tr key={post.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3">
                        <div className="line-clamp-2 pr-4">{post.content?.title || "Untitled post"}</div>
                      </td>
                      <td className="py-3 text-right">{numberFormatter.format(post.views)}</td>
                      <td className="py-3 text-right">{numberFormatter.format(post.reach)}</td>
                      <td className="py-3 text-right">{formatEngagement(post.engagement_rate)}</td>
                      <td className="py-3 text-right">{numberFormatter.format(post.likes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCard
              icon={<MessageCircle className="h-8 w-8" />}
              title="No posts found"
              description="There are no posts for the selected time period."
              showShadow={false}
              variant="simple"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
