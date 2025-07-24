"use client"

import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { TrendItem } from "@/app/types/trends"
import { TrendingUp, TrendingDown, ExternalLink, Sparkles, Target, Clock } from "@/app/components/ui/icons"

// Simple HTML cleaning function for frontend
function cleanHtmlContent(htmlString: string): string {
  console.log('🧽 [TrendCard cleanHtmlContent] Input:', htmlString?.substring(0, 100))
  
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
  
  console.log('✨ [TrendCard cleanHtmlContent] Output:', cleaned)
  return cleaned
}

interface TrendCardProps {
  trend: TrendItem
  onClick: (trend: TrendItem) => void
}

// Platform icon mapping
const PLATFORM_ICONS: Record<string, React.ReactElement> = {
  google: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  twitter: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  reddit: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  ),
  linkedin: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  tiktok: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  ),
  youtube: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  instagram: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  google: 'text-blue-600',
  twitter: 'text-black dark:text-white',
  reddit: 'text-orange-600',
  linkedin: 'text-blue-700',
  tiktok: 'text-black dark:text-white',
  youtube: 'text-red-600',
  instagram: 'text-pink-600'
}

export function TrendCard({ trend, onClick }: TrendCardProps) {
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
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? 'text-green-600' : 'text-red-600'
    }
  }

  const changeData = formatChange(trend.change)
  const platformIcon = PLATFORM_ICONS[trend.platform]
  const platformColor = PLATFORM_COLORS[trend.platform]

  return (
    <Card 
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:translate-y-[-2px] group"
      onClick={() => onClick(trend)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-3 items-start flex-1 min-w-0">
            <div className={`bg-primary/10 rounded-md flex items-center justify-center min-w-[40px] ${platformColor}`} style={{ width: '40px', height: '40px' }}>
              {platformIcon}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{cleanHtmlContent(trend.title)}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className="text-xs capitalize whitespace-nowrap"
                  style={{ 
                    backgroundColor: `var(--${trend.platform}-bg, rgb(245, 245, 245))`,
                    color: `var(--${trend.platform}-text, rgb(100, 100, 100))`
                  }}
                >
                  {trend.platform === 'google' && trend.metadata?.news_type ? 'news' : trend.platform}
                </Badge>
                {trend.category && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground truncate">{trend.category}</span>
                  </>
                )}
                {/* Show source for news */}
                {trend.platform === 'google' && trend.metadata?.source && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground truncate">{trend.metadata.source}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{formatScore(trend.score)}</span>
              {changeData && (
                <div className={`flex items-center gap-0.5 ${changeData.color}`}>
                  <changeData.icon className="h-3 w-3" />
                  <span className="text-xs font-medium">{changeData.value}%</span>
                </div>
              )}
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        
        {trend.description && (
          <div className="mt-3 p-3 bg-muted/20 rounded-md border border-border/20">
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{cleanHtmlContent(trend.description)}</p>
          </div>
        )}
        
        {/* Commercial Intelligence Indicators */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            {/* Business Impact */}
            {trend.businessImpact && trend.businessImpact !== 'low' && (
              <div className="flex items-center gap-1">
                <Target className={`h-3 w-3 ${
                  trend.businessImpact === 'high' ? 'text-green-600' : 'text-yellow-600'
                }`} />
                <span className={`text-xs font-medium ${
                  trend.businessImpact === 'high' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {trend.businessImpact === 'high' ? 'High Impact' : 'Med Impact'}
                </span>
              </div>
            )}
            
            {/* Content Opportunity */}
            {trend.contentOpportunity && trend.contentOpportunity !== 'low' && (
              <div className="flex items-center gap-1">
                <Sparkles className={`h-3 w-3 ${
                  trend.contentOpportunity === 'high' ? 'text-purple-600' : 'text-blue-600'
                }`} />
                <span className={`text-xs font-medium ${
                  trend.contentOpportunity === 'high' ? 'text-purple-600' : 'text-blue-600'
                }`}>
                  {trend.contentOpportunity === 'high' ? 'Hot Topic' : 'Good Topic'}
                </span>
              </div>
            )}
            
            {/* Timing Signals */}
            {trend.commercialSignals?.some(signal => signal.includes('freshness') || signal.includes('timing')) && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-orange-600" />
                <span className="text-xs font-medium text-orange-600">Fresh</span>
              </div>
            )}
          </div>
          
          {/* Relevance Score */}
          {trend.relevanceScore && trend.relevanceScore > 50 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Score:</span>
              <span className={`text-xs font-medium ${
                trend.relevanceScore > 100 ? 'text-green-600' : 
                trend.relevanceScore > 75 ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {trend.relevanceScore}
              </span>
            </div>
          )}
        </div>

        {/* Keywords and tags - more compact */}
        {((trend.tags && trend.tags.length > 0) || (trend.matchedKeywords && trend.matchedKeywords.length > 0)) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {/* Show top matched keywords first (business relevance) */}
            {trend.matchedKeywords?.slice(0, 2).map((keyword, index) => {
              const keywordText = keyword.includes(':') ? keyword.split(':')[1] : keyword
              const isCommercial = keyword.includes('pain:') || keyword.includes('goal:') || keyword.includes('commercial:')
              return (
                <Badge 
                  key={`keyword-${index}`} 
                  variant={isCommercial ? "default" : "outline"}
                  className={`text-xs px-1.5 py-0.5 ${isCommercial ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
                >
                  {keywordText.length > 12 ? `${keywordText.substring(0, 12)}...` : keywordText}
                </Badge>
              )
            })}
            
            {/* Show regular tags if space */}
            {trend.tags?.slice(0, 2).map((tag, index) => (
              <Badge key={`tag-${index}`} variant="secondary" className="text-xs px-1.5 py-0.5">
                {tag.length > 10 ? `${tag.substring(0, 10)}...` : tag}
              </Badge>
            ))}
            
            {/* Show count of additional items */}
            {((trend.tags?.length || 0) + (trend.matchedKeywords?.length || 0)) > 4 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                +{((trend.tags?.length || 0) + (trend.matchedKeywords?.length || 0)) - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 