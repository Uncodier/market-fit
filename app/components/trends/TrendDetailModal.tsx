"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"

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
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { TrendItem } from "@/app/types/trends"
import { TrendingUp, TrendingDown, ExternalLink, Clock, Tag, Globe, BarChart, Lightbulb, Users, MessageSquare } from "@/app/components/ui/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Separator } from "@/app/components/ui/separator"

interface TrendDetailModalProps {
  trend: TrendItem | null
  isOpen: boolean
  onClose: () => void
}

interface TopicItem {
  type: string
  text: string
  icon: string
}

interface DiscussionItem {
  title: string
  subreddit?: string
  upvotes?: number
  comments?: number
  source?: string
  volume?: string
  timeframe?: string
  author?: string
  retweets?: number
  likes?: number
}

interface CommercialSignal {
  type: string
  text: string
  icon: string
}

// Platform icon mapping (reused from TrendCard)
const PLATFORM_ICONS: Record<string, React.ReactElement> = {
  google: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  twitter: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  reddit: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  ),
  linkedin: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  tiktok: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  ),
  youtube: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  instagram: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.40z"/>
    </svg>
  )
}

// Generate related topics and subtopics
const getRelatedTopics = (trend: TrendItem): TopicItem[] => {
  const topics: TopicItem[] = []
  
  // Extract from keywords
  if (trend.matchedKeywords) {
    trend.matchedKeywords.forEach(keyword => {
      if (keyword.includes('pain:')) {
        topics.push({ type: 'Pain Point', text: keyword.split(':')[1], icon: '⚠️' })
      } else if (keyword.includes('goal:')) {
        topics.push({ type: 'Goal', text: keyword.split(':')[1], icon: '🎯' })
      } else if (keyword.includes('commercial:')) {
        topics.push({ type: 'Commercial', text: keyword.split(':')[1], icon: '💼' })
      }
    })
  }
  
  // Add tags as topics
  if (trend.tags) {
    trend.tags.slice(0, 5).forEach(tag => {
      topics.push({ type: 'Topic', text: tag, icon: '🏷️' })
    })
  }
  
  return topics.slice(0, 8)
}

// Generate mock data for demonstration (in real implementation, this would come from the API)
const getMockDiscussions = (trend: TrendItem): DiscussionItem[] => {
  const discussions: DiscussionItem[] = []
  
  if (trend.platform === 'reddit') {
    discussions.push(
      { title: `Discussion about ${trend.title.split(' ').slice(0, 3).join(' ')}`, subreddit: 'r/technology', upvotes: 1240, comments: 89 },
      { title: `${trend.title.split(' ').slice(-2).join(' ')} - What do you think?`, subreddit: 'r/startups', upvotes: 567, comments: 45 },
      { title: `Analysis: ${trend.title.split(' ').slice(1, 4).join(' ')}`, subreddit: 'r/business', upvotes: 892, comments: 67 }
    )
  } else if (trend.platform === 'google') {
    discussions.push(
      { title: `"${trend.title.split(' ').slice(0, 4).join(' ')}" search trends`, source: 'Google Trends', volume: '50K+ searches', timeframe: 'Last 7 days' },
      { title: `Rising interest in ${trend.title.split(' ').slice(-3).join(' ')}`, source: 'Search Console', volume: '25K+ searches', timeframe: 'Last 24 hours' }
    )
  } else if (trend.platform === 'twitter') {
    discussions.push(
      { title: `Thread: ${trend.title.split(' ').slice(0, 4).join(' ')}`, author: '@TechAnalyst', retweets: 234, likes: 1560 },
      { title: `Breaking: ${trend.title.split(' ').slice(-4).join(' ')}`, author: '@NewsSource', retweets: 567, likes: 3240 }
    )
  }
  
  return discussions
}

// Get commercial signals
const getCommercialData = (trend: TrendItem): CommercialSignal[] => {
  const signals: CommercialSignal[] = []
  
  if (trend.commercialSignals) {
    trend.commercialSignals.forEach(signal => {
      if (signal.includes('launch')) signals.push({ type: 'Product Launch', text: signal, icon: '🚀' })
      else if (signal.includes('funding')) signals.push({ type: 'Funding', text: signal, icon: '💰' })
      else if (signal.includes('acquisition')) signals.push({ type: 'Acquisition', text: signal, icon: '🤝' })
      else if (signal.includes('update')) signals.push({ type: 'Update', text: signal, icon: '🔄' })
      else signals.push({ type: 'Commercial', text: signal, icon: '📈' })
    })
  }
  
  return signals.slice(0, 6)
}

export function TrendDetailModal({ trend, isOpen, onClose }: TrendDetailModalProps) {
  if (!trend) return null

  const formatScore = (score?: number) => {
    if (!score) return 'N/A'
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`
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

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const changeData = formatChange(trend.change)
  const platformIcon = PLATFORM_ICONS[trend.platform]
  const relatedTopics = getRelatedTopics(trend)
  const discussions = getMockDiscussions(trend)
  const commercialData = getCommercialData(trend)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: '56px', height: '56px' }}>
              {platformIcon}
            </div>
            <div className="flex-1 space-y-2">
              <DialogTitle className="text-xl leading-tight pr-8">{cleanHtmlContent(trend.title)}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">
                  {trend.platform}
                </Badge>
                {trend.category && (
                  <Badge variant="secondary">
                    {trend.category}
                  </Badge>
                )}
                {changeData && (
                  <Badge variant="outline" className={changeData.color}>
                    <changeData.icon className="h-3 w-3 mr-1" />
                    {changeData.value}%
                  </Badge>
                )}
                {trend.relevanceScore && trend.relevanceScore > 50 && (
                  <Badge variant="outline">
                    Score: {trend.relevanceScore}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {trend.description && (
            <DialogDescription className="text-base leading-relaxed">
              {cleanHtmlContent(trend.description)}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* TOP SECTION: Metrics and Related Topics in 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT COLUMN: Trend Metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-purple-600" />
                  Trend Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trend Score</span>
                  <span className="font-medium">{formatScore(trend.score)}</span>
                </div>
                
                {changeData && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">24h Change</span>
                    <div className={`flex items-center gap-1 ${changeData.color}`}>
                      <changeData.icon className="h-3 w-3" />
                      <span className="text-sm font-medium">{changeData.value}%</span>
                    </div>
                  </div>
                )}

                {trend.relevanceScore && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Business Relevance</span>
                    <span className={`text-sm font-medium ${
                      trend.relevanceScore > 100 ? 'text-green-600' : 
                      trend.relevanceScore > 75 ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {trend.relevanceScore}/150
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Platform</span>
                  <Badge variant="outline" className="capitalize text-xs">
                    {trend.platform}
                  </Badge>
                </div>

                {trend.region && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Region</span>
                    <span className="text-sm">{trend.region}</span>
                  </div>
                )}

                {/* Advanced Scoring Metrics */}
                {((trend as any).hotnessScore || (trend as any).viralPotential || (trend as any).impactScore) && (
                  <>
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Advanced Analytics</p>
                    </div>
                    
                    {(trend as any).hotnessScore && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Hotness Score</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{(trend as any).hotnessScore.toFixed(1)}</span>
                          {(trend as any).hotnessRating && (
                            <Badge variant="outline" className={`text-xs ${
                              (trend as any).hotnessRating === 'very-hot' ? 'border-red-500 text-red-600' :
                              (trend as any).hotnessRating === 'hot' ? 'border-orange-500 text-orange-600' :
                              (trend as any).hotnessRating === 'warm' ? 'border-yellow-500 text-yellow-600' :
                              'border-gray-400 text-gray-600'
                            }`}>
                              {(trend as any).hotnessRating}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {(trend as any).viralPotential && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Viral Potential</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{(trend as any).viralPotential.toFixed(1)}</span>
                          {(trend as any).viralRating && (
                            <Badge variant="outline" className={`text-xs ${
                              (trend as any).viralRating === 'very-viral' ? 'border-pink-500 text-pink-600' :
                              (trend as any).viralRating === 'viral' ? 'border-purple-500 text-purple-600' :
                              'border-gray-400 text-gray-600'
                            }`}>
                              {(trend as any).viralRating}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {(trend as any).impactScore && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Impact Score</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{(trend as any).impactScore.toFixed(1)}</span>
                          {(trend as any).impactRating && (
                            <Badge variant="outline" className={`text-xs ${
                              (trend as any).impactRating === 'high-impact' ? 'border-emerald-500 text-emerald-600' :
                              (trend as any).impactRating === 'medium-impact' ? 'border-blue-500 text-blue-600' :
                              'border-gray-400 text-gray-600'
                            }`}>
                              {(trend as any).impactRating}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* RIGHT COLUMN: Related Topics, Themes & Keywords */}
            {(relatedTopics.length > 0 || (trend.tags && trend.tags.length > 0) || (trend.matchedKeywords && trend.matchedKeywords.length > 0)) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-5 w-5 text-blue-600" />
                    Related Topics & Keywords
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Related Topics */}
                  {relatedTopics.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-3">Related Topics & Themes</p>
                      <div className="space-y-2">
                        {relatedTopics.slice(0, 4).map((topic: TopicItem, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                            <span className="text-base">{topic.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-muted-foreground">{topic.type}</p>
                              <p className="text-sm line-clamp-1">{topic.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords & Tags Section */}
                  {((trend.tags && trend.tags.length > 0) || (trend.matchedKeywords && trend.matchedKeywords.length > 0)) && (
                    <div className={relatedTopics.length > 0 ? "border-t pt-4" : ""}>
                      {/* Matched Business Keywords */}
                      {trend.matchedKeywords && trend.matchedKeywords.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Business Keywords</p>
                          <div className="flex flex-wrap gap-1.5">
                            {trend.matchedKeywords.slice(0, 6).map((keyword: string, index: number) => {
                              const keywordText = keyword.includes(':') ? keyword.split(':')[1] : keyword
                              const isCommercial = keyword.includes('pain:') || keyword.includes('goal:') || keyword.includes('commercial:')
                              
                              return (
                                <Badge 
                                  key={index} 
                                  variant={isCommercial ? "default" : "secondary"} 
                                  className="text-xs"
                                >
                                  {keywordText}
                                </Badge>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* General Tags */}
                      {trend.tags && trend.tags.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {trend.tags.slice(0, 6).map((tag: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Discussions/Posts */}
          {discussions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                  {trend.platform === 'reddit' ? 'Recent Discussions' : 
                   trend.platform === 'google' ? 'Search Data' : 'Popular Posts'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {discussions.map((item: DiscussionItem, index: number) => (
                  <div key={index} className="border rounded-md p-3 hover:bg-muted/30 transition-colors">
                    <h4 className="font-medium text-sm mb-2 line-clamp-2">{item.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {trend.platform === 'reddit' && (
                        <>
                          <span className="font-medium">{item.subreddit}</span>
                          <span>↑ {item.upvotes}</span>
                          <span>💬 {item.comments}</span>
                        </>
                      )}
                      {trend.platform === 'google' && (
                        <>
                          <span className="font-medium">{item.source}</span>
                          <span>🔍 {item.volume}</span>
                          <span>📅 {item.timeframe}</span>
                        </>
                      )}
                      {trend.platform === 'twitter' && (
                        <>
                          <span className="font-medium">{item.author}</span>
                          <span>🔄 {item.retweets}</span>
                          <span>❤️ {item.likes}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Commercial Activity */}
          {commercialData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-purple-600" />
                  Commercial Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {commercialData.map((signal: CommercialSignal, index: number) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <span className="text-lg">{signal.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{signal.type}</p>
                        <p className="text-sm">{signal.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}



          {/* Additional Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Last updated {formatDate(trend.timestamp)}</span>
                </div>
                {trend.url && (
                  <>
                    <span>•</span>
                    <button 
                      onClick={() => window.open(trend.url, '_blank')}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>View source</span>
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          {trend.url && (
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => window.open(trend.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on {trend.platform}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 