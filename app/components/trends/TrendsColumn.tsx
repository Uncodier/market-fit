"use client"

import { useState } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { TrendDetailModal } from "./TrendDetailModal"
import { TrendItem } from "@/app/types/trends"
import { TrendingUp, TrendingDown, RotateCcw, ExternalLink } from "@/app/components/ui/icons"
import { cleanHtmlContent, TRENDS_PLATFORMS, type TrendsSegments } from "./trends-presentation"
import { useTrendsResults } from "./use-trends-results"
import { TrendsAvailability, TrendsEmptyState } from "./TrendsAvailability"

interface TrendsColumnProps {
  className?: string
  segments?: TrendsSegments
  currentSiteId?: string
  contextReady?: boolean
}

// Compact Trend Card for the column
function CompactTrendCard({ trend, onClick }: { trend: TrendItem, onClick: (trend: TrendItem) => void }) {
  const formatScore = (score?: number) => {
    if (!score) return 'N/A'
    if (score >= 1000) return `${(score / 1000).toFixed(0)}K`
    return score.toString()
  }

  const formatChange = (change?: number) => {
    if (change === undefined || change === null) return null
    const isPositive = change >= 0
    return {
      value: Math.abs(change).toFixed(1),
      isPositive,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? 'text-green-600' : 'text-red-600'
    }
  }

  const changeData = formatChange(trend.change)

  // Platform icon (simplified)
  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'google': return 'text-blue-600'
      case 'twitter': return 'text-black dark:text-white'
      case 'reddit': return 'text-orange-600'
      case 'linkedin': return 'text-blue-700'
      case 'tiktok': return 'text-black dark:text-white'
      case 'youtube': return 'text-red-600'
      case 'instagram': return 'text-pink-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <Card
      className="mb-2 cursor-pointer transition-shadow duration-200 hover:shadow-md"
      onClick={() => onClick(trend)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
              {cleanHtmlContent(trend.title)}
            </h4>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>

        {trend.description && (
          <div className="mt-2 mb-2">
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{cleanHtmlContent(trend.description)}</p>
          </div>
        )}

        {/* Platform, Score and Trend Change - All moved to footer with separator */}
        <div className="flex mt-2 border-t pt-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs capitalize ${getPlatformColor(trend.platform)}`}
              >
                {trend.platform}
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">
                {formatScore(trend.score)}
              </span>
            </div>
            {changeData && (
              <div className={`flex items-center gap-0.5 ${changeData.color}`}>
                <changeData.icon className="h-2.5 w-2.5" />
                <span className="text-xs font-medium">{changeData.value}%</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TrendsColumn({ className = "", segments, currentSiteId, contextReady }: TrendsColumnProps) {
  const { trends, isLoading, platformErrors, error, status, contextKey, canRequest, refresh } = useTrendsResults({
    currentSiteId, segments, contextReady, sortBy: 'hotness', view: 'column'
  })
  // Context preparation uses the same skeleton as loading, not a separate waiting message.
  const showSkeleton = !canRequest || isLoading
  const [selection, setSelection] = useState<{ trend: TrendItem; key: string } | null>(null)
  if (selection && selection.key !== contextKey) setSelection(null)
  const selectedTrend = selection?.key === contextKey ? trends.find(trend => trend.id === selection.trend.id) ?? null : null
  const handleTrendClick = (trend: TrendItem) => setSelection({ trend, key: contextKey })
  const handleRefresh = () => {
    setSelection(null)
    refresh()
  }

  const renderTrendsSkeleton = () => (
    <>
      {Array.from({ length: TRENDS_PLATFORMS.length * 3 }).map((_, i) => (
        <Card key={i} className="mb-2">
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3 w-3" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )

  return (
    <>
      {/* Trends Column - Styled like Kanban columns */}
      <div className={`flex-shrink-0 w-80 h-fit max-h-full min-h-0 flex flex-col justify-start ${className}`}>
        <div className="bg-background rounded-t-md p-3 border-b border-x border-t flex-none">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Trends</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || !canRequest}
                aria-label="Refresh trends"
                className="h-6 w-6 p-0"
              >
                {showSkeleton ? (
                  <LoadingSkeleton size="sm" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
              </Button>
              <Badge variant="outline" className="text-xs">
                {trends.length}
              </Badge>
            </div>
          </div>
        </div>
        <div className="bg-muted/30 rounded-b-md p-2 border-b border-x overflow-y-auto min-h-0">
          {!isLoading && canRequest && <TrendsAvailability platformErrors={platformErrors} error={error} failed={status === 'failed'} />}
          {showSkeleton ? (
            renderTrendsSkeleton()
          ) : trends.length > 0 ? (
            <>
              {trends.map((trend) => (
                <CompactTrendCard
                  key={trend.id}
                  trend={trend}
                  onClick={handleTrendClick}
                />
              ))}
            </>
          ) : (
            <TrendsEmptyState canRequest={canRequest} failed={status === 'failed'} onRetry={handleRefresh} />
          )}
        </div>
      </div>

      <TrendDetailModal
        trend={selectedTrend}
        isOpen={Boolean(selectedTrend)}
        onClose={() => setSelection(null)}
      />
    </>
  )
}
