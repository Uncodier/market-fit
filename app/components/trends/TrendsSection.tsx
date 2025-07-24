"use client"

import { useState, useEffect } from "react"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { TrendCard } from "./TrendCard"
import { TrendDetailModal } from "./TrendDetailModal"
import { TrendItem, TrendPlatform } from "@/app/types/trends"
import { trendsManager } from "@/app/services/trends-service"
import { Loader, TrendingUp, RotateCcw, ExternalLink, TrendingDown, ChevronLeft, ChevronRight, Target, Sparkles, LayoutGrid, Clock } from "@/app/components/ui/icons"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { toast } from "sonner"
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

interface TrendsSectionProps {
  className?: string
  segments?: Array<{ id: string; name: string; description?: string }>
  currentSiteId?: string
  displayMode?: 'cards' | 'table'
}

export function TrendsSection({ className = "", segments, currentSiteId, displayMode = 'cards' }: TrendsSectionProps) {
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activePlatforms, setActivePlatforms] = useState<TrendPlatform[]>(['google', 'reddit'])
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [sortBy, setSortBy] = useState<'relevance' | 'hotness' | 'viral' | 'impact' | 'cross-platform' | 'recent'>('relevance')
  
  // Pagination state for table view
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  useEffect(() => {
    if (currentSiteId) {
      console.log(`🔄 [TrendsSection] Site changed to ${currentSiteId}, reloading trends with ${segments?.length || 0} segments`)
      fetchTrends()
    }
  }, [currentSiteId, sortBy, segments]) // Add segments as dependency to reload when site segments change

  const fetchTrends = async () => {
    setIsLoading(true)
    try {
      // Use higher limit to get enough trends for quality selection in table view
      const result = await trendsManager.getAllTrends(activePlatforms, segments, { 
        limitPerPlatform: 15, // Get 15 per platform to select best 10
        sortBy: sortBy
      })
      
      if (result.success && result.data) {
        // Group trends by platform and take top 6 from each, sorted by relevance
        const trendsByPlatform = result.data.trends.reduce((acc, trend) => {
          if (!acc[trend.platform]) {
            acc[trend.platform] = []
          }
          acc[trend.platform].push(trend)
          return acc
        }, {} as Record<string, typeof result.data.trends>)
        
        console.log('🔍 [TrendsSection] Trends by platform:', 
          Object.entries(trendsByPlatform).map(([platform, trends]) => 
            `${platform}: ${trends.length}`
          ).join(', ')
        )
        
        // Trends are already sorted by the TrendsManager based on sortBy parameter
        const finalTrends = Object.values(trendsByPlatform)
          .map(platformTrends => platformTrends.slice(0, 10)) // Take top 10 from each platform
          .flat() // Flatten back to single array
        
        console.log(`📊 [TrendsSection] Final trends count: ${finalTrends.length} (sorted by ${sortBy})`)
        setTrends(finalTrends)
        setLastUpdated(result.data.lastUpdated)
      } else {
        toast.error("Failed to fetch trends: " + (result.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error fetching trends:", error)
      toast.error("An error occurred while fetching trends")
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value))
    setCurrentPage(1) // Reset to first page
  }

  const formatLastUpdated = (timestamp: string) => {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }

  const renderTrendsSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 18 }).map((_, i) => ( // 3 platforms × 6 trends each = 18 total
        <Card key={i} className="h-[140px]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex gap-3 items-start flex-1">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-8" />
            </div>
            <Skeleton className="h-3 w-full mt-3" />
            <div className="flex gap-1 mt-2">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const renderTrendsTable = () => {
    // Calculate pagination
    const totalPages = Math.ceil(trends.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedTrends = trends.slice(startIndex, endIndex)

    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Trend</TableHead>
              <TableHead className="w-[100px]">Platform</TableHead>
              <TableHead className="w-[80px]">Score</TableHead>
              <TableHead className="w-[80px]">Change</TableHead>
              <TableHead className="w-[180px]">Keywords</TableHead>
              <TableHead className="w-[140px]">Opportunity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrends.length > 0 ? (
              paginatedTrends.map((trend) => {
            const formatScore = (score?: number) => {
              if (!score) return 'N/A'
              if (score >= 1000) return `${(score / 1000).toFixed(1)}K`
              return score.toString()
            }

            const formatChange = (change?: number) => {
              if (change === undefined || change === null) return null
              const isPositive = change >= 0
              return {
                value: Math.abs(change).toFixed(1),
                isPositive,
                color: isPositive ? 'text-green-600' : 'text-red-600'
              }
            }

            const changeData = formatChange(trend.change)

            return (
              <TableRow 
                key={trend.id}
                className="group hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleTrendClick(trend)}
              >
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm line-clamp-2" title={cleanHtmlContent(trend.title)}>{cleanHtmlContent(trend.title)}</p>
                    {trend.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1" title={cleanHtmlContent(trend.description)}>{cleanHtmlContent(trend.description)}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className="text-xs capitalize"
                  >
                    {trend.platform}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {formatScore(trend.score)}
                </TableCell>
                <TableCell>
                  {changeData && (
                    <div className={`flex items-center gap-1 ${changeData.color}`}>
                      {changeData.isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span className="text-xs font-medium">{changeData.value}%</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {/* Show matched keywords first */}
                    {trend.matchedKeywords?.slice(0, 2).map((keyword, index) => {
                      const keywordText = keyword.includes(':') ? keyword.split(':')[1] : keyword
                      const isCommercial = keyword.includes('pain:') || keyword.includes('goal:') || keyword.includes('commercial:')
                      return (
                        <Badge 
                          key={`keyword-${index}`} 
                          variant={isCommercial ? "default" : "outline"}
                          className={`text-xs px-1.5 py-0.5 ${isCommercial ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
                        >
                          {keywordText.length > 10 ? `${keywordText.substring(0, 10)}...` : keywordText}
                        </Badge>
                      )
                    })}
                    
                    {/* Show tags as fallback if no matched keywords or to fill remaining space */}
                    {((trend.matchedKeywords?.length || 0) < 2) && trend.tags?.slice(0, 3 - (trend.matchedKeywords?.length || 0)).map((tag, index) => (
                      <Badge 
                        key={`tag-${index}`} 
                        variant="secondary" 
                        className="text-xs px-1.5 py-0.5"
                      >
                        {tag.length > 10 ? `${tag.substring(0, 10)}...` : tag}
                      </Badge>
                    ))}
                    
                    {/* Show placeholder if no keywords or tags */}
                    {(!trend.matchedKeywords || trend.matchedKeywords.length === 0) && 
                     (!trend.tags || trend.tags.length === 0) && (
                      <span className="text-xs text-muted-foreground">No keywords</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {/* Content Opportunity */}
                    {trend.contentOpportunity && trend.contentOpportunity !== 'low' && (
                      <div className="flex items-center gap-1">
                        <Sparkles className={`h-3 w-3 ${
                          trend.contentOpportunity === 'high' ? 'text-purple-600' : 'text-blue-600'
                        }`} />
                        <span className={`text-xs ${
                          trend.contentOpportunity === 'high' ? 'text-purple-600' : 'text-blue-600'
                        }`}>
                          {trend.contentOpportunity === 'high' ? 'Hot Topic' : 'Good Topic'}
                        </span>
                      </div>
                    )}
                    
                    {/* Freshness */}
                    {trend.commercialSignals?.some(signal => signal.includes('freshness') || signal.includes('timing')) && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-orange-600" />
                        <span className="text-xs text-orange-600">Fresh</span>
                      </div>
                    )}
                    
                    {/* Relevance Score */}
                    {trend.relevanceScore && trend.relevanceScore > 50 && (
                      <span className={`text-xs ${
                        trend.relevanceScore > 100 ? 'text-green-600' : 
                        trend.relevanceScore > 75 ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        Score: {trend.relevanceScore}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center">
              No trends found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    
    {/* Pagination Controls */}
    {trends.length > itemsPerPage && (
      <div className="flex items-center justify-between px-4 py-2 border-t">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
            <span className="font-medium">
              {Math.min(endIndex, trends.length)}
            </span>{" "}
            of <span className="font-medium">{trends.length}</span> results
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={handleItemsPerPageChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page = i + 1
              if (totalPages > 5) {
                if (currentPage > 3) {
                  page = currentPage - 2 + i
                  if (page > totalPages) page = totalPages - 4 + i
                }
              }
              if (page < 1 || page > totalPages) return null
              return (
                <Button
                  key={page}
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className={`!min-w-0 h-8 w-8 p-0 font-medium transition-colors ${
                    currentPage === page 
                      ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {page}
                </Button>
              )
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    )}
  </div>
  )
}

  const renderTrendsTableSkeleton = () => (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Trend</TableHead>
            <TableHead className="w-[100px]">Platform</TableHead>
            <TableHead className="w-[80px]">Score</TableHead>
            <TableHead className="w-[80px]">Change</TableHead>
            <TableHead className="w-[180px]">Keywords</TableHead>
            <TableHead className="w-[140px]">Opportunity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between px-4 py-2 border-t">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-[180px]" />
          <Skeleton className="h-8 w-[70px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8" />
            ))}
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Card className={`${className}`}>
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
                {activePlatforms.map(platform => (
                  <Badge key={platform} variant="secondary" className="text-xs capitalize">
                    {platform}
                  </Badge>
                ))}
              </div>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
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
                disabled={isLoading}
                className="h-8 w-8 p-0"
              >
                {isLoading ? (
                  <Loader className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {isLoading ? (
            displayMode === 'table' ? renderTrendsTableSkeleton() : renderTrendsSkeleton()
          ) : trends.length > 0 ? (
            displayMode === 'table' ? (
              renderTrendsTable()
            ) : (
              <ScrollArea className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2">
                  {trends.map((trend) => (
                    <TrendCard
                      key={trend.id}
                      trend={trend}
                      onClick={handleTrendClick}
                    />
                  ))}
                </div>
              </ScrollArea>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="bg-muted/40 rounded-full flex items-center justify-center mb-4" style={{ width: '60px', height: '60px' }}>
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">No trends available</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                We couldn't fetch trending topics at the moment. 
                Please try refreshing or check back later.
              </p>
              <Button variant="outline" onClick={handleRefresh}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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