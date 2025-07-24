"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { TrendDetailModal } from "./TrendDetailModal"
import { TrendItem, TrendPlatform } from "@/app/types/trends"
import { trendsManager } from "@/app/services/trends-service"
import { Loader, TrendingUp, TrendingDown, RotateCcw, ExternalLink } from "@/app/components/ui/icons"
import { toast } from "sonner"

interface TrendsColumnProps {
  className?: string
  segments?: Array<{ id: string; name: string; description?: string }>
  currentSiteId?: string
}

// Simple HTML cleaning function for frontend
function cleanHtmlContent(htmlString: string): string {
  if (!htmlString || typeof htmlString !== 'string') return ''
  
  let cleaned = htmlString.trim()
  
  // Handle CDATA sections
  cleaned = cleaned.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
  
  // Remove all HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '')
  
  // Clean basic HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...')
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '')
  
  // Remove source attribution patterns
  cleaned = cleaned.replace(/\s*[-–—]\s*[A-Za-z\s]+\s*$/g, '')
  cleaned = cleaned.replace(/^\s*[-–—]\s*/g, '')
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
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
      className="mb-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]"
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

export function TrendsColumn({ className = "", segments, currentSiteId }: TrendsColumnProps) {
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activePlatforms] = useState<TrendPlatform[]>(['google', 'reddit'])
  const [sortBy] = useState<'relevance' | 'hotness' | 'viral' | 'impact' | 'cross-platform' | 'recent'>('hotness') // Default to hotness for column view

  useEffect(() => {
    if (currentSiteId) {
      console.log(`🔄 [TrendsColumn] Site changed to ${currentSiteId}, reloading trends with ${segments?.length || 0} segments`)
      fetchTrends()
    }
  }, [currentSiteId, segments]) // Add segments as dependency to reload when site segments change

  const fetchTrends = async () => {
    setIsLoading(true)
    try {
      // Get enough trends for quality selection in kanban view
      const result = await trendsManager.getAllTrends(activePlatforms, segments, { 
        limitPerPlatform: 10, // Get 10 per platform to select best 5
        sortBy: sortBy
      })
      
      if (result.success && result.data) {
        // Group trends by platform to ensure we get from all platforms
        const trendsByPlatform = result.data.trends.reduce((acc, trend) => {
          if (!acc[trend.platform]) {
            acc[trend.platform] = []
          }
          acc[trend.platform].push(trend)
          return acc
        }, {} as Record<string, typeof result.data.trends>)
        
        console.log('🔍 [TrendsColumn] Trends by platform:', 
          Object.entries(trendsByPlatform).map(([platform, trends]) => 
            `${platform}: ${trends.length}`
          ).join(', ')
        )
        
        // Take top 5 from each platform and then sort all by relevance/score
        const allTopTrends: TrendItem[] = []
        
        activePlatforms.forEach(platform => {
          const platformTrends = trendsByPlatform[platform] || []
          const topTrends = platformTrends.slice(0, 5) // Take top 5 from each platform
          allTopTrends.push(...topTrends)
        })
        
        // Sort all trends by relevance score (highest first)
        const sortedTrends = allTopTrends.sort((a, b) => {
          const aScore = (a as any).relevanceScore || a.score || 0
          const bScore = (b as any).relevanceScore || b.score || 0
          return bScore - aScore
        })
        
        console.log(`📊 [TrendsColumn] Final ${sortedTrends.length} trends sorted by relevance`)
        setTrends(sortedTrends)
      }
    } catch (error) {
      console.error("Error fetching trends:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTrendClick = (trend: TrendItem) => {
    setSelectedTrend(trend)
    setIsModalOpen(true)
  }

  const handleRefresh = () => {
    fetchTrends()
  }

  const renderTrendsSkeleton = () => (
    <>
      {Array.from({ length: 9 }).map((_, i) => ( // 3 platforms × 3 trends each = 9 total
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
      <div className="flex-shrink-0 w-80">
        <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Trends</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="h-6 w-6 p-0"
              >
                {isLoading ? (
                  <Loader className="h-3 w-3" />
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
        <div className="bg-muted/30 rounded-b-md p-2 border-b border-x">
          {isLoading ? (
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
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No trends available
            </div>
          )}
        </div>
      </div>

      <TrendDetailModal
        trend={selectedTrend}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTrend(null)
        }}
      />
    </>
  )
} 