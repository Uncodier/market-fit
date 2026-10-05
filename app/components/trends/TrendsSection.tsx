"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Loader, TrendingUp, RotateCcw, Target, Sparkles, LayoutGrid, Clock } from "@/app/components/ui/icons"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import type { TrendItem } from "@/app/types/trends"
import { TrendCard } from "./TrendCard"
import { TrendDetailModal } from "./TrendDetailModal"
import { TrendsTable } from "./TrendsTable"
import { TrendsGridSkeleton, TrendsTableSkeleton } from "./TrendsLoading"
import { TrendsAvailability, TrendsEmptyState } from "./TrendsAvailability"
import { formatLastUpdated, TRENDS_PLATFORMS, type TrendsSegments, type TrendsSort } from "./trends-presentation"
import { useTrendsResults } from "./use-trends-results"

interface TrendsSectionProps {
  className?: string
  segments?: TrendsSegments
  currentSiteId?: string
  contextReady?: boolean
  displayMode?: 'cards' | 'table'
}

export function TrendsSection({ className = "", segments, currentSiteId, contextReady, displayMode = 'cards' }: TrendsSectionProps) {
  const [sortBy, setSortBy] = useState<TrendsSort>('relevance')
  const { trends, isLoading, lastUpdated, platformErrors, error, status, contextKey, canRequest, refresh } = useTrendsResults({
    currentSiteId, segments, contextReady, sortBy, view: 'section'
  })
  // Keep the original loading layout while context resolves, without starting a request early.
  const showSkeleton = !canRequest || isLoading
  const [selection, setSelection] = useState<{ trend: TrendItem; key: string } | null>(null)
  if (selection && selection.key !== contextKey) setSelection(null)
  const selectedTrend = selection?.key === contextKey ? trends.find(trend => trend.id === selection.trend.id) ?? null : null
  const handleTrendClick = (trend: TrendItem) => setSelection({ trend, key: contextKey })
  const handleRefresh = () => {
    setSelection(null)
    refresh()
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '40px', height: '40px' }}>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Market Intelligence</CardTitle>
                <p className="text-sm text-muted-foreground">
                  6 best per channel • {trends.length} total results{displayMode === 'table' && trends.length > 5 && ' • Paginated'}
                  {segments && segments.length > 0 && (
                    <span className="ml-2">• {segments.length} segment{segments.length === 1 ? '' : 's'}</span>
                  )}{lastUpdated && (
                    <span className="ml-2">• Updated {formatLastUpdated(lastUpdated)}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {TRENDS_PLATFORMS.map(platform => (
                  <Badge key={platform} variant="secondary" className="text-xs capitalize">
                    {platform}
                  </Badge>
                ))}
              </div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as TrendsSort)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3" />
                      <span>Relevance</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="hotness">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-orange-500" />
                      <span>Hotness</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viral">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span>Viral Potential</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="impact">
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3 text-purple-500" />
                      <span>Business Impact</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cross-platform">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-3 w-3 text-blue-500" />
                      <span>Cross-Platform</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="recent">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span>Most Recent</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || !canRequest}
                aria-label="Refresh trends"
                className="h-8 w-8 p-0"
              >
                {showSkeleton ? (
                  <Loader className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isLoading && canRequest && (
          <div className="px-4">
            <TrendsAvailability platformErrors={platformErrors} error={error} failed={status === 'failed'} />
          </div>
        )}
        {displayMode === 'table' ? (
          <>
            {/* Retain pagination preferences on retry without displaying old results. */}
            <div hidden={showSkeleton || trends.length === 0}>
              <TrendsTable key={contextKey} trends={trends} onTrendClick={handleTrendClick} />
            </div>
            {showSkeleton ? <TrendsTableSkeleton /> : trends.length === 0 && (
              <CardContent className="pt-0">
                <TrendsEmptyState canRequest={canRequest} failed={status === 'failed'} onRetry={handleRefresh} />
              </CardContent>
            )}
          </>
        ) : (
          <CardContent className="pt-0">
            {showSkeleton ? (
              <TrendsGridSkeleton />
            ) : trends.length > 0 ? (
              <ScrollArea className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2">
                  {trends.map(trend => <TrendCard key={trend.id} trend={trend} onClick={handleTrendClick} />)}
                </div>
              </ScrollArea>
            ) : (
              <TrendsEmptyState canRequest={canRequest} failed={status === 'failed'} onRetry={handleRefresh} />
            )}
          </CardContent>
        )}
      </Card>
      <TrendDetailModal trend={selectedTrend} isOpen={Boolean(selectedTrend)} onClose={() => setSelection(null)} />
    </>
  )
}
