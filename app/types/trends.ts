// Trend Platform Types
export type TrendPlatform = 'google' | 'reddit' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'instagram'

// Base Trend Item
export interface TrendItem {
  id: string
  title: string
  description?: string
  score?: number
  change?: number // percentage change
  platform: TrendPlatform
  category?: string
  tags?: string[]
  url?: string
  relatedKeywords?: string[]
  region?: string
  timestamp: string
  metadata?: Record<string, any>
  // Enhanced properties for segment relevance
  relevanceScore?: number
  matchedKeywords?: string[]
  // Commercial intelligence properties
  commercialSignals?: string[]
  businessImpact?: 'low' | 'medium' | 'high'
  contentOpportunity?: 'low' | 'medium' | 'high'
  // Advanced scoring properties
  hotnessScore?: number
  viralPotential?: number
  impactScore?: number
  crossPlatformBonus?: number
  hotnessRating?: 'very-hot' | 'hot' | 'warm' | 'cool'
  viralRating?: 'very-viral' | 'viral' | 'growing' | 'stable'
  impactRating?: 'high-impact' | 'medium-impact' | 'low-impact'
  crossPlatformTopics?: Array<{
    word: string
    platforms: string[]
    count: number
  }>
}

// Trend Response
export interface TrendResponse {
  success: boolean
  data?: TrendItem[]
  error?: string
  platform: TrendPlatform
  timestamp: string
  region?: string
  count?: number
}

// Trend Service Configuration
export interface TrendConfig {
  apiKey?: string
  apiSecret?: string
  region?: string
  language?: string
  category?: string
  limit?: number
  segments?: Array<{ id: string; name: string; description?: string }>
  keywords?: string[]
}

// Platform-specific configurations
export interface GoogleTrendsConfig extends TrendConfig {
  geo?: string // Country code (e.g., 'US', 'ES')
  hl?: string // Language (e.g., 'en', 'es')
  timeframe?: string // e.g., 'now 1-d', 'now 7-d', 'today 12-m'
}

export interface RedditTrendsConfig extends TrendConfig {
  subreddit?: string
  sortBy?: 'hot' | 'new' | 'rising' | 'top'
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'
}

export interface TwitterTrendsConfig extends TrendConfig {
  woeid?: number // Where On Earth ID for location
}

// Trend Service Interface
export interface TrendService {
  platform: TrendPlatform
  isEnabled: boolean
  config: TrendConfig
  fetchTrends(segments?: Array<{ id: string; name: string; description?: string }>): Promise<TrendResponse>
}

// Aggregated Trends Response
export interface AggregatedTrendsResponse {
  success: boolean
  data?: {
    trends: TrendItem[]
    platforms: TrendPlatform[]
    totalCount: number
    lastUpdated: string
    sortBy?: 'relevance' | 'hotness' | 'viral' | 'impact' | 'cross-platform' | 'recent'
    analytics?: {
      hotTrends: number
      viralTrends: number
      crossPlatformTrends: number
      highImpactTrends: number
    }
  }
  error?: string
}

// Trend Analytics
export interface TrendAnalytics {
  platform: TrendPlatform
  trending_up: TrendItem[]
  trending_down: TrendItem[]
  new_trends: TrendItem[]
  stable_trends: TrendItem[]
} 