"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useSite } from "@/app/context/SiteContext"
import { getContentCommentConversations, getContentPerformanceForItem, type ContentCommentConversation } from "@/app/components/dashboard/social-actions"
import { Activity, Eye, Share, MessageCircle, Heart, BarChart } from "@/app/components/ui/icons"
import { getNetworkIcon } from "../content-shared"

interface ContentPerformancePanelProps {
  contentId: string
  outstandPostId?: string
}

const EMPTY_METRICS = {
  views: null as number | null,
  reach: null as number | null,
  engagement_rate: null as number | null,
  likes: null as number | null,
  comments: null as number | null,
  shares: null as number | null,
  metrics_by_account: [] as Array<Record<string, any>>,
}

function formatCount(value: number | null | undefined) {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function formatEngagement(rate: number | null | undefined) {
  if (rate == null) return "—"
  const n = Number(rate) || 0
  return new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 })
    .format(n > 1 ? n / 100 : n)
}

function KpiRow({ title, value, icon: Icon }: { title: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function ContentPerformancePanel({ contentId, outstandPostId }: ContentPerformancePanelProps) {
  const { currentSite } = useSite()
  const [data, setData] = useState<any>(null)
  const [conversations, setConversations] = useState<ContentCommentConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentSite || currentSite.id === "default") {
      setData(null)
      setConversations([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    Promise.all([
      getContentPerformanceForItem(currentSite.id, contentId, outstandPostId),
      getContentCommentConversations(currentSite.id, contentId, outstandPostId),
    ]).then(([performance, threads]) => {
      if (cancelled) return
      setData(performance.data || null)
      setConversations(threads.data || [])
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [currentSite, contentId, outstandPostId])

  const metrics = data || EMPTY_METRICS
  const networks = metrics.metrics_by_account || []

  return (
    <div className="p-5 space-y-5">
      <div className="space-y-2">
        <KpiRow title="Views" value={isLoading ? "—" : formatCount(metrics.views)} icon={Eye} />
        <KpiRow title="Reach" value={isLoading ? "—" : formatCount(metrics.reach)} icon={BarChart} />
        <KpiRow title="Engagement" value={isLoading ? "—" : formatEngagement(metrics.engagement_rate)} icon={Activity} />
        <KpiRow title="Likes" value={isLoading ? "—" : formatCount(metrics.likes)} icon={Heart} />
        <KpiRow title="Comments" value={isLoading ? "—" : formatCount(metrics.comments)} icon={MessageCircle} />
        <KpiRow title="Shares" value={isLoading ? "—" : formatCount(metrics.shares)} icon={Share} />
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          By Network
        </h4>
        {networks.length > 0 ? (
          <div className="space-y-2">
            {networks.map((acc: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm capitalize">
                  {getNetworkIcon(acc.network || "unknown")}
                  <span>{acc.network || "—"}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatCount(acc.views)} views · {formatCount(acc.likes)} likes
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">Network</span>
            <span className="text-sm font-semibold tabular-nums">—</span>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Comments
        </h4>
        {conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((thread) => (
              <Link
                key={thread.id}
                href={`/chat?conversationId=${thread.id}`}
                className="block rounded-lg bg-muted/40 px-3 py-2.5 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{thread.title || "Comment thread"}</span>
                  {thread.channel ? getNetworkIcon(thread.channel) : <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {thread.preview || "—"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Conversation</span>
              <span className="text-sm font-semibold tabular-nums">—</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">—</p>
          </div>
        )}
      </div>
    </div>
  )
}
