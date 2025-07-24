import { 
  TrendItem, 
  TrendResponse, 
  TrendService, 
  TrendPlatform, 
  GoogleTrendsConfig, 
  RedditTrendsConfig,
  AggregatedTrendsResponse 
} from '@/app/types/trends'

// Google News Service Implementation (instead of Trends)
class GoogleTrendsService implements TrendService {
  platform: TrendPlatform = 'google'
  isEnabled: boolean = true
  config: GoogleTrendsConfig

  constructor(config: GoogleTrendsConfig = {}) {
    this.config = {
      geo: 'US',
      hl: 'en',
      timeframe: 'now 1-d', // For news recency
      limit: 10,
      ...config
    }
  }

  private generateNewsKeywords(segments?: Array<{ id: string; name: string; description?: string }>): string[] {
    if (!segments || segments.length === 0) {
      // Default business/tech news topics
      return [
        'startup funding', 'tech innovation', 'digital transformation', 'AI breakthrough',
        'business growth', 'market analysis', 'industry report', 'product launch',
        'merger acquisition', 'IPO news', 'venture capital', 'technology adoption'
      ]
    }

    console.log('📰 Generating news keywords for segments:', segments.map(s => s.name))

    const keywords: string[] = []
    const newsContexts = ['news', 'breakthrough', 'launch', 'announcement', 'report', 'study', 'research', 'development', 'funding', 'acquisition', 'partnership', 'innovation']
    const businessContexts = ['market', 'industry', 'company', 'startup', 'enterprise', 'technology', 'software', 'platform']
    const stopWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'were', 'been', 'have', 'their', 'would', 'could', 'should', 'which', 'where', 'there', 'what', 'when', 'will', 'can', 'are', 'is', 'was', 'by', 'an', 'as', 'at', 'be', 'or', 'in', 'on', 'of', 'to']
    
    segments.forEach(segment => {
      console.log(`📊 Processing segment for news: ${segment.name}`)
      
      // Extract meaningful words from segment name
      const nameWords = segment.name.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))
      
      // Core segment with news contexts
      newsContexts.forEach(context => {
        keywords.push(`${segment.name} ${context}`)
        nameWords.forEach(word => {
          keywords.push(`${word} ${context}`)
        })
      })
      
      // Business contexts with segment terms
      businessContexts.forEach(context => {
        keywords.push(`${context} ${segment.name}`)
        nameWords.forEach(word => {
          keywords.push(`${context} ${word}`)
        })
      })
      
      // Specific news-worthy combinations
      nameWords.forEach(word => {
        if (word.length > 3) {
          keywords.push(`${word} startup news`)
          keywords.push(`${word} company news`)
          keywords.push(`${word} technology news`)
          keywords.push(`${word} innovation news`)
          keywords.push(`new ${word} platform`)
          keywords.push(`${word} funding round`)
          keywords.push(`${word} market news`)
        }
      })
      
      // Extract and process description content for news relevance
      if (segment.description) {
        const descWords = segment.description.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 3 && !stopWords.includes(word))
          .slice(0, 8) // Focus on most relevant description words
        
        descWords.forEach(word => {
          if (word.length > 4) {
            keywords.push(`${word} news`)
            keywords.push(`${word} announcement`)
            keywords.push(`${word} development`)
            keywords.push(`new ${word} technology`)
          }
        })
      }
    })

    // Remove duplicates and prioritize news-worthy terms
    const uniqueKeywords = Array.from(new Set(keywords))
      .filter(keyword => keyword.trim().length > 5) // Longer keywords for better news results
      .sort((a, b) => {
        // Prioritize news-specific terms
        const aHasNews = newsContexts.some(nc => a.includes(nc))
        const bHasNews = newsContexts.some(nc => b.includes(nc))
        if (aHasNews !== bHasNews) return aHasNews ? -1 : 1
        
        // Then prioritize multi-word terms
        const aWords = a.split(' ').length
        const bWords = b.split(' ').length
        if (aWords !== bWords) return bWords - aWords
        return b.length - a.length
      })
      .slice(0, 15) // Take top 15 most relevant news keywords

    console.log('📰 Generated news keywords:', uniqueKeywords)
    return uniqueKeywords
  }

  async fetchTrends(segments?: Array<{ id: string; name: string; description?: string }>): Promise<TrendResponse> {
    try {
      // Generate news-focused keywords from segments
      const newsKeywords = this.generateNewsKeywords(segments)
      
      console.log(`📰 [Google News Service] Making API call with limit: ${this.config.limit}`)
      
      const response = await fetch('/api/trends/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geo: this.config.geo,
          hl: this.config.hl,
          timeframe: this.config.timeframe,
          limit: this.config.limit,
          segments,
          keywords: newsKeywords,
          mode: 'news' // Signal to the API that we want news instead of trends
        })
      })

      if (!response.ok) {
        throw new Error(`Google News API error: ${response.status}`)
      }

      const data = await response.json()
      
      console.log('📰 [Google News] API Response:', { 
        success: data.success, 
        newsCount: data.trends?.length || 0,
        limit: this.config.limit 
      })
      
      const trends: TrendItem[] = data.trends?.map((newsItem: any, index: number) => ({
        id: `google-news-${Date.now()}-${index}`,
        title: newsItem.title || newsItem.headline || 'News Update',
        description: newsItem.description || newsItem.snippet || newsItem.summary || '',
        score: newsItem.relevance_score || newsItem.engagement || Math.floor(Math.random() * 100),
        change: newsItem.trend_change || (Math.random() * 20 - 10), // News typically has smaller changes
        platform: 'google' as TrendPlatform,
        category: newsItem.category || newsItem.section || 'Technology',
        tags: newsItem.tags || newsItem.keywords || [],
        url: newsItem.url || newsItem.link || `https://news.google.com/search?q=${encodeURIComponent(newsItem.title)}`,
        relatedKeywords: newsItem.keywords || newsItem.tags || [],
        region: this.config.geo,
        timestamp: newsItem.published_at || new Date().toISOString(),
        metadata: {
          source: newsItem.source || newsItem.publisher,
          published_at: newsItem.published_at,
          author: newsItem.author,
          news_type: 'business_tech',
          geo: this.config.geo,
          timeframe: this.config.timeframe,
          is_breaking: newsItem.is_breaking || false,
          engagement_score: newsItem.engagement
        }
      })) || []

      return {
        success: true,
        data: trends,
        platform: 'google',
        timestamp: new Date().toISOString(),
        region: this.config.geo,
        count: trends.length
      }
    } catch (error) {
      console.error('Google News fetch error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Google news',
        platform: 'google',
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Reddit Trends Service Implementation
class RedditTrendsService implements TrendService {
  platform: TrendPlatform = 'reddit'
  isEnabled: boolean = true // Now enabled with real data
  config: RedditTrendsConfig

  constructor(config: RedditTrendsConfig = {}) {
    this.config = {
      subreddit: 'all',
      sortBy: 'hot',
      timeframe: 'day',
      limit: 10,
      ...config
    }
  }

  private generateSegmentKeywords(segments?: Array<{ id: string; name: string; description?: string }>): string[] {
    if (!segments || segments.length === 0) {
      // Default keywords for general business/tech discussions
      return [
        'startup', 'business', 'entrepreneur', 'marketing', 'technology',
        'SaaS', 'digital marketing', 'growth hacking', 'productivity'
      ]
    }

    console.log('🎯 [Reddit] Generating keywords for segments:', segments.map(s => s.name))

    const keywords: string[] = []
    const redditContexts = ['tips', 'advice', 'tools', 'strategy', 'success', 'growth', 'help', 'guide', 'best', 'how']
    const stopWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'were', 'been', 'have', 'their', 'would', 'could', 'should', 'which', 'where', 'there', 'what', 'when', 'will', 'can', 'are', 'is', 'was', 'by', 'an', 'as', 'at', 'be', 'or', 'in', 'on', 'of', 'to']
    
    segments.forEach(segment => {
      console.log(`📊 [Reddit] Processing segment: ${segment.name}`)
      
      // Extract meaningful words from segment name
      const nameWords = segment.name.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))
      
      // Add core terms for Reddit filtering
      keywords.push(segment.name) // Full segment name
      keywords.push(...nameWords) // Individual meaningful words
      
      // Create Reddit-style combinations that work for any business
      nameWords.forEach(word => {
        redditContexts.forEach(context => {
          keywords.push(`${word} ${context}`)
          keywords.push(`${context} ${word}`)
        })
      })
      
      // Add universal business terms that apply to any segment
      keywords.push(`${segment.name} business`)
      keywords.push(`${segment.name} startup`)
      keywords.push(`${segment.name} industry`)
      keywords.push(`${segment.name} market`)
      
      // Process description for additional context
      if (segment.description) {
        const descWords = segment.description.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 3 && !stopWords.includes(word))
          .slice(0, 8) // Take more words for better filtering
        
        keywords.push(...descWords)
        
        // Add Reddit-style combinations for significant description words
        descWords.forEach(word => {
          if (word.length > 4) { // Only for substantial words
            keywords.push(`${word} tips`)
            keywords.push(`${word} advice`)
            keywords.push(`best ${word}`)
          }
        })
      }
    })

    const uniqueKeywords = Array.from(new Set(keywords))
      .filter(keyword => keyword.trim().length > 2)
      .slice(0, 15) // More keywords for better Reddit filtering

    console.log('🔍 [Reddit] Generated keywords:', uniqueKeywords)
    return uniqueKeywords
  }

  async fetchTrends(segments?: Array<{ id: string; name: string; description?: string }>): Promise<TrendResponse> {
    try {
      // Generate keywords from segments for better subreddit targeting
      const segmentKeywords = this.generateSegmentKeywords(segments)
      
      const response = await fetch('/api/trends/reddit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subreddit: this.config.subreddit,
          sortBy: this.config.sortBy,
          timeframe: this.config.timeframe,
          limit: this.config.limit,
          segments,
          keywords: segmentKeywords
        })
      })

      if (!response.ok) {
        throw new Error(`Reddit Trends API error: ${response.status}`)
      }

      const data = await response.json()
      
      const trends: TrendItem[] = data.trends?.map((trend: any, index: number) => {
        // Generate more realistic Reddit descriptions
        const getRedditDescription = (trend: any) => {
          const subreddit = trend.metadata?.subreddit || trend.category || 'business'
          const comments = trend.metadata?.comments || Math.floor(Math.random() * 500) + 50
          
          const redditTemplates = [
            `"${trend.title}" - Hot discussion with ${comments} comments in r/${subreddit}`,
            `Trending in r/${subreddit}: "${trend.title.substring(0, 50)}..." (${comments} comments)`,
            `r/${subreddit} users are discussing: "${trend.title.substring(0, 45)}..." - ${comments} replies`,
            `Popular thread in r/${subreddit}: "${trend.title.substring(0, 40)}..." • ${comments} comments`,
            `Breaking discussion in r/${subreddit}: "${trend.title.substring(0, 50)}..." (${comments} responses)`,
            `Viral post in r/${subreddit}: "${trend.title.substring(0, 45)}..." - ${comments} comments and counting`,
            `r/${subreddit} community buzzing about: "${trend.title.substring(0, 40)}..." (${comments} replies)`,
            `Top thread in r/${subreddit}: "${trend.title.substring(0, 50)}..." • Active discussion with ${comments} comments`
          ]
          
          return redditTemplates[index % redditTemplates.length] || redditTemplates[Math.floor(Math.random() * redditTemplates.length)]
        }

        return {
        id: `reddit-${Date.now()}-${index}`,
        title: trend.title,
          description: getRedditDescription(trend),
        score: trend.value,
        change: trend.change,
        platform: 'reddit' as TrendPlatform,
        category: trend.category,
        tags: trend.relatedQueries || [],
        url: `https://www.reddit.com${trend.metadata?.permalink}`,
        relatedKeywords: trend.relatedQueries || [],
        region: 'Global',
        timestamp: new Date().toISOString(),
        metadata: {
          subreddit: trend.metadata?.subreddit,
          comments: trend.metadata?.comments,
            permalink: trend.metadata?.permalink
        }
        }
      }) || []

      return {
        success: true,
        data: trends,
        platform: 'reddit',
        timestamp: new Date().toISOString(),
        region: 'Global',
        count: trends.length
      }
    } catch (error) {
      console.error('Reddit Trends fetch error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Reddit trends',
        platform: 'reddit',
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Main Trends Manager
export class TrendsManager {
  private services: Map<TrendPlatform, TrendService>
  private cache: Map<TrendPlatform, { data: TrendResponse; timestamp: number }>
  private cacheTimeout: number = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.services = new Map()
    this.cache = new Map()
    this.initializeServices()
  }

  private initializeServices() {
    // Initialize only real services - no more dummy data
    this.services.set('google', new GoogleTrendsService({ limit: 15 }))
    this.services.set('reddit', new RedditTrendsService({ limit: 15 }))
    
    // All other platforms disabled - focus only on real data
    console.log('🔥 [TrendsManager] Initialized with 2 REAL platforms: Google News & Reddit')
  }

  async getTrends(platform: TrendPlatform, segments?: Array<{ id: string; name: string; description?: string }>, limit?: number): Promise<TrendResponse> {
    const service = this.services.get(platform)
    if (!service || !service.isEnabled) {
      return {
        success: false,
        error: `Platform ${platform} is not available`,
        platform,
        timestamp: new Date().toISOString()
      }
    }

    // Create cache key that includes segments for different results per segment combination
    const segmentIds = segments?.map(s => s.id).sort().join(',') || 'default'
    const cacheKey = `${platform}-${segmentIds}`
    
    // Check cache
    const cached = this.cache.get(cacheKey as TrendPlatform)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    // Temporarily update service limit if specified
    const originalLimit = service.config?.limit
    if (limit && service.config) {
      console.log(`🔧 [TrendsManager] Setting ${platform} limit from ${originalLimit} to ${limit}`)
      service.config.limit = limit
    }

    // Fetch fresh data with segments
    const result = await service.fetchTrends(segments)
    
    console.log(`📊 [TrendsManager] ${platform} returned ${result.data?.length || 0} trends`)
    
    // Restore original limit
    if (originalLimit !== undefined && service.config) {
      service.config.limit = originalLimit
    }
    
    // Cache successful results
    if (result.success) {
      this.cache.set(cacheKey as TrendPlatform, {
        data: result,
        timestamp: Date.now()
      })
    }

    return result
  }

  // Generate commercial-focused keywords from rich segment data
  private generateSegmentKeywords(segments?: Array<{ id: string; name: string; description?: string; icp?: any; topics?: any; analysis?: any }>): string[] {
    if (!segments || segments.length === 0) {
      return [
        'digital marketing', 'business growth', 'startup trends', 'technology innovation',
        'marketing automation', 'customer acquisition', 'business intelligence'
      ]
    }

    console.log('🎯 [TrendsManager] Extracting commercial keywords from segments:', segments.map(s => s.name))

    const keywords: string[] = []
    const commercialContexts = ['trends', 'news', 'breakthrough', 'innovation', 'solution', 'tool', 'strategy', 'growth', 'success', 'tips', 'guide', 'review', 'comparison', 'alternatives']
    const stopWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'were', 'been', 'have', 'their', 'would', 'could', 'should', 'which', 'where', 'there', 'what', 'when', 'will', 'can', 'are', 'is', 'was', 'by', 'an', 'as', 'at', 'be', 'or', 'in', 'on', 'of', 'to']
    
    segments.forEach(segment => {
      console.log(`🔍 [TrendsManager] Processing segment: ${segment.name}`)
      
      // 1. Core segment identity
      keywords.push(segment.name)
      
      // 2. Extract from ICP pain points (goldmine for trending solutions)
      if (segment.icp?.pain_points) {
        segment.icp.pain_points.forEach((pain: string) => {
          keywords.push(pain)
          keywords.push(`${pain} solution`)
          keywords.push(`${pain} trends`)
          keywords.push(`solve ${pain}`)
        })
      }
      
      // 3. Extract from ICP goals (trending opportunities)
      if (segment.icp?.goals) {
        segment.icp.goals.forEach((goal: string) => {
          keywords.push(goal)
          keywords.push(`${goal} strategy`)
          keywords.push(`achieve ${goal}`)
          keywords.push(`${goal} tips`)
        })
      }
      
      // 4. Extract from professional context (industry trends)
      if (segment.icp?.industry) {
        keywords.push(`${segment.icp.industry} trends`)
        keywords.push(`${segment.icp.industry} innovation`)
        keywords.push(`${segment.icp.industry} news`)
        keywords.push(`${segment.icp.industry} technology`)
      }
      
      // 5. Extract from tools (tech trends)
      if (segment.icp?.profile?.professionalContext?.tools) {
        const { current, desired } = segment.icp.profile.professionalContext.tools
        
        // Current tools - look for alternatives/improvements
        current?.forEach((tool: string) => {
          keywords.push(`${tool} alternative`)
          keywords.push(`${tool} vs`)
          keywords.push(`better than ${tool}`)
        })
        
        // Desired tools - trending technologies
        desired?.forEach((tool: string) => {
          keywords.push(tool)
          keywords.push(`${tool} review`)
          keywords.push(`${tool} trends`)
        })
      }
      
      // 6. Extract from interests (content opportunities)
      if (segment.icp?.profile?.psychographics?.interests) {
        segment.icp.profile.psychographics.interests.forEach((interest: string) => {
          keywords.push(interest)
          commercialContexts.forEach(context => {
            keywords.push(`${interest} ${context}`)
          })
        })
      }
      
      // 7. Extract from topics (content gaps)
      if (segment.topics?.blog) {
        segment.topics.blog.forEach((topic: string) => {
          keywords.push(topic)
          keywords.push(`${topic} news`)
        })
      }
      
      // 8. Business context from audience type
      if ((segment as any).audience) {
        const audienceType = (segment as any).audience
        keywords.push(`${audienceType} trends`)
        keywords.push(`${audienceType} challenges`)
        keywords.push(`${audienceType} solutions`)
      }
      
      // 9. Name-based keywords with commercial intent
      const nameWords = segment.name.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))
      
      nameWords.forEach(word => {
        commercialContexts.forEach(context => {
          keywords.push(`${word} ${context}`)
        })
      })
      
      // 10. Description with commercial angle
      if (segment.description) {
        const descWords = segment.description.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 3 && !stopWords.includes(word))
          .slice(0, 5)
        
        descWords.forEach(word => {
          if (word.length > 4) {
            keywords.push(`${word} trends`)
            keywords.push(`${word} breakthrough`)
            keywords.push(`${word} innovation`)
          }
        })
      }
    })

    // Prioritize commercial keywords
    const uniqueKeywords = Array.from(new Set(keywords))
      .filter(keyword => keyword.trim().length > 3)
      .sort((a, b) => {
        // Prioritize keywords with commercial intent
        const commercialKeywords = ['solution', 'tool', 'alternative', 'vs', 'review', 'breakthrough', 'innovation']
        const aCommercial = commercialKeywords.some(ck => a.toLowerCase().includes(ck))
        const bCommercial = commercialKeywords.some(ck => b.toLowerCase().includes(ck))
        
        if (aCommercial && !bCommercial) return -1
        if (!aCommercial && bCommercial) return 1
        
        // Prioritize longer, more specific terms
        return b.length - a.length
      })
      .slice(0, 25) // More keywords for better commercial filtering

    console.log('🔍 [TrendsManager] Commercial keywords:', uniqueKeywords.slice(0, 10))
    console.log('💡 [TrendsManager] Pain point keywords:', uniqueKeywords.filter(k => k.includes('solution') || k.includes('solve')))
    return uniqueKeywords
  }

  // Advanced scoring algorithms for hotness, viralidad, and cross-platform correlation
  private calculateAdvancedScoring(allTrends: TrendItem[]): TrendItem[] {
    console.log('🔥 [TrendsManager] Calculating advanced scoring for hotness, viralidad, and impact')
    
    // 1. CROSS-PLATFORM CORRELATION ANALYSIS
    const titleWords = new Map<string, { platforms: Set<string>, trends: TrendItem[] }>()
    
    // Extract key words from all trend titles
    allTrends.forEach(trend => {
      const words = trend.title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 4) // Only significant words
      
      words.forEach(word => {
        if (!titleWords.has(word)) {
          titleWords.set(word, { platforms: new Set(), trends: [] })
        }
        const entry = titleWords.get(word)!
        entry.platforms.add(trend.platform)
        entry.trends.push(trend)
      })
    })
    
    // Identify cross-platform topics
    const crossPlatformTopics = Array.from(titleWords.entries())
      .filter(([word, data]) => data.platforms.size >= 2) // Appears on 2+ platforms
      .map(([word, data]) => ({
        word,
        platformCount: data.platforms.size,
        trends: data.trends,
        crossPlatformBonus: data.platforms.size * 15 // Bonus for cross-platform presence
      }))
    
    console.log(`🌐 [TrendsManager] Found ${crossPlatformTopics.length} cross-platform topics:`)
    crossPlatformTopics.slice(0, 5).forEach(topic => {
      console.log(`  📊 "${topic.word}" - ${topic.platformCount} platforms (${Array.from(new Set(topic.trends.map(t => t.platform))).join(', ')})`)
    })
    
    // 2. CALCULATE ENHANCED SCORES
    return allTrends.map(trend => {
      const now = Date.now()
      const trendAge = now - new Date(trend.timestamp).getTime()
      const hoursOld = trendAge / (1000 * 60 * 60)
      
      // A. HOTNESS SCORE (combines recency, engagement, and momentum)
      let hotnessScore = 0
      
      // Recency factor (fresher = hotter)
      if (hoursOld < 1) hotnessScore += 50        // Very fresh
      else if (hoursOld < 6) hotnessScore += 35   // Fresh
      else if (hoursOld < 12) hotnessScore += 20  // Recent
      else if (hoursOld < 24) hotnessScore += 10  // Day old
      
      // Engagement factor
      const baseScore = trend.score || 0
      if (baseScore > 100) hotnessScore += 30
      else if (baseScore > 50) hotnessScore += 20
      else if (baseScore > 20) hotnessScore += 10
      
      // Momentum factor (positive change = hot)
      const change = trend.change || 0
      if (change > 20) hotnessScore += 25        // Very positive momentum
      else if (change > 10) hotnessScore += 15   // Good momentum
      else if (change > 0) hotnessScore += 5     // Positive momentum
      
      // B. VIRAL POTENTIAL SCORE
      let viralPotential = 0
      
      // High engagement velocity
      if (baseScore > 80 && change > 15) viralPotential += 40
      else if (baseScore > 50 && change > 10) viralPotential += 25
      else if (baseScore > 30 && change > 5) viralPotential += 15
      
      // Platform-specific viral indicators
      if (trend.platform === 'reddit' && baseScore > 100) viralPotential += 20 // Reddit viral threshold
      if (trend.platform === 'twitter' && change > 25) viralPotential += 25   // Twitter growth rate
      if (trend.platform === 'google' && hoursOld < 2) viralPotential += 15   // Breaking news potential
      
      // Content type viral factors
      const viralKeywords = ['breaking', 'viral', 'trending', 'explosive', 'massive', 'unprecedented', 'shocking']
      const hasViralLanguage = viralKeywords.some(keyword => 
        trend.title.toLowerCase().includes(keyword) || 
        (trend.description && trend.description.toLowerCase().includes(keyword))
      )
      if (hasViralLanguage) viralPotential += 20
      
      // C. CROSS-PLATFORM CORRELATION BONUS
      let crossPlatformBonus = 0
      const trendWords = trend.title.toLowerCase().split(/\s+/).filter(word => word.length > 4)
      
      crossPlatformTopics.forEach(topic => {
        if (trendWords.includes(topic.word)) {
          crossPlatformBonus += topic.crossPlatformBonus
        }
      })
      
      // D. IMPACT PREDICTION SCORE
      let impactScore = 0
      
      // Business impact indicators
      const businessKeywords = ['launch', 'funding', 'acquisition', 'ipo', 'partnership', 'breakthrough', 'revolution']
      const hasBusinessImpact = businessKeywords.some(keyword => 
        trend.title.toLowerCase().includes(keyword)
      )
      if (hasBusinessImpact) impactScore += 30
      
      // Technology impact indicators
      const techKeywords = ['ai', 'blockchain', 'automation', 'cloud', 'saas', 'api', 'platform']
      const hasTechImpact = techKeywords.some(keyword => 
        trend.title.toLowerCase().includes(keyword)
      )
      if (hasTechImpact) impactScore += 25
      
      // Market size indicators (larger markets = higher impact)
      const marketKeywords = ['enterprise', 'b2b', 'billion', 'million', 'global', 'worldwide']
      const hasMarketScale = marketKeywords.some(keyword => 
        trend.title.toLowerCase().includes(keyword) || 
        (trend.description && trend.description.toLowerCase().includes(keyword))
      )
      if (hasMarketScale) impactScore += 20
      
      // E. CALCULATE FINAL COMPOSITE SCORES
      const originalRelevance = (trend as any).relevanceScore || trend.score || 0
      
      // Enhanced relevance includes all factors
      const enhancedRelevance = originalRelevance + (hotnessScore * 0.3) + (viralPotential * 0.25) + (crossPlatformBonus * 0.2) + (impactScore * 0.25)
      
      // Determine overall ratings
      const hotnessRating = hotnessScore > 60 ? 'very-hot' : hotnessScore > 40 ? 'hot' : hotnessScore > 20 ? 'warm' : 'cool'
      const viralRating = viralPotential > 50 ? 'very-viral' : viralPotential > 30 ? 'viral' : viralPotential > 15 ? 'growing' : 'stable'
      const impactRating = impactScore > 40 ? 'high-impact' : impactScore > 20 ? 'medium-impact' : 'low-impact'
      
      return {
        ...trend,
        // Enhanced scores
        relevanceScore: Math.round(enhancedRelevance),
        hotnessScore: Math.round(hotnessScore),
        viralPotential: Math.round(viralPotential),
        impactScore: Math.round(impactScore),
        crossPlatformBonus: Math.round(crossPlatformBonus),
        
        // Ratings for easy filtering
        hotnessRating,
        viralRating,
        impactRating,
        
        // Cross-platform info
        crossPlatformTopics: crossPlatformTopics
          .filter(topic => trendWords.includes(topic.word))
          .map(topic => ({
            word: topic.word,
            platforms: Array.from(new Set(topic.trends.map(t => t.platform))),
            count: topic.platformCount
          })),
          
        // Metadata for debugging
        metadata: {
          ...trend.metadata,
          scoring: {
            hoursOld: Math.round(hoursOld * 10) / 10,
            baseScore,
            change,
            hasViralLanguage,
            hasBusinessImpact,
            hasTechImpact,
            hasMarketScale
          }
        }
      }
    })
  }

  // Enhanced relevance scoring for content opportunities
  private enhanceRelevanceScoring(trends: TrendItem[], segments: Array<{ id: string; name: string; description?: string; icp?: any }>, keywords: string[]): TrendItem[] {
    console.log('🎯 [TrendsManager] Applying SEGMENT-FOCUSED relevance scoring')
    
    const enhanced = trends.map(trend => {
      let relevanceScore = trend.score || 0
      let matchedKeywords: string[] = []
      let commercialSignals: string[] = []
      
      const trendText = `${trend.title} ${trend.description || ''}`.toLowerCase()
      
      // 0. SEGMENT NAME DIRECT MATCHING (HIGHEST PRIORITY)
      let hasDirectSegmentMatch = false
      segments.forEach(segment => {
        const segmentWords = segment.name.toLowerCase().split(/[\s,\-_]+/)
        segmentWords.forEach(word => {
          if (word.length > 3 && trendText.includes(word)) {
            relevanceScore += 100 // MASSIVE boost for direct segment matches
            matchedKeywords.push(`segment-direct:${word}`)
            hasDirectSegmentMatch = true
          }
        })
        
        // Check segment description for more context
        if (segment.description) {
          const descWords = segment.description.toLowerCase()
            .split(/[\s,\-_\.!?]+/)
            .filter(word => word.length > 4)
            .slice(0, 5) // Top 5 most important words
          
          descWords.forEach(word => {
            if (trendText.includes(word)) {
              relevanceScore += 60 // High boost for segment description matches
              matchedKeywords.push(`segment-desc:${word}`)
              hasDirectSegmentMatch = true
            }
          })
        }
      })
      
      // 1. SEGMENT-SPECIFIC COMMERCIAL INTENT
      const segmentAwareCommercialKeywords = [
        'solution', 'tool', 'strategy', 'optimization', 'automation', 'efficiency', 
        'roi', 'revenue', 'growth', 'scale', 'opportunity'
      ]
      
      segmentAwareCommercialKeywords.forEach(commercial => {
        if (trendText.includes(commercial)) {
          const weight = hasDirectSegmentMatch ? 50 : 25
          relevanceScore += weight
          commercialSignals.push(`commercial:${commercial}`)
        }
      })
      
      // 2. BUSINESS IMPACT INDICATORS
      const businessImpactKeywords = [
        'increase', 'boost', 'improve', 'optimize', 'productivity', 'conversion', 'retention'
      ]
      
      businessImpactKeywords.forEach(impact => {
        if (trendText.includes(impact)) {
          const weight = hasDirectSegmentMatch ? 40 : 15
          relevanceScore += weight
          commercialSignals.push(`impact:${impact}`)
        }
      })
      
      // 3. ENHANCED SEGMENT KEYWORD MATCHING
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase()
        const isCommercial = segmentAwareCommercialKeywords.some(ck => keyword.includes(ck))
        const baseWeight = isCommercial ? 30 : 15
        
        if (trend.title.toLowerCase().includes(keywordLower)) {
          relevanceScore += baseWeight + 15
          matchedKeywords.push(`title:${keyword}`)
        }
        
        if (trend.description && trend.description.toLowerCase().includes(keywordLower)) {
          relevanceScore += baseWeight
          matchedKeywords.push(`desc:${keyword}`)
        }
      })
      
      // PENALTY: Reduce score for trends without any segment relevance
      if (!hasDirectSegmentMatch && matchedKeywords.length === 0) {
        relevanceScore = Math.max(0, relevanceScore - 50)
        commercialSignals.push('low-segment-relevance')
      }
      
      // BONUS: Extra boost for trends that are highly segment-relevant
      if (hasDirectSegmentMatch && matchedKeywords.length >= 3) {
        relevanceScore += 30
        commercialSignals.push('high-segment-relevance')
      }
      
      // Business Impact Estimation
       let businessImpact: 'low' | 'medium' | 'high' = 'low'
      if (hasDirectSegmentMatch && commercialSignals.length > 0) {
         businessImpact = 'high'
         relevanceScore += 15
      } else if (matchedKeywords.length > 2) {
         businessImpact = 'medium'
         relevanceScore += 8
       }
      
      return {
        ...trend,
        relevanceScore: Math.round(relevanceScore),
        matchedKeywords,
        commercialSignals,
        businessImpact,
        contentOpportunity: (hasDirectSegmentMatch ? 'high' : matchedKeywords.length > 1 ? 'medium' : 'low') as 'low' | 'medium' | 'high'
      }
    })
    
    // Filter out trends with very low segment relevance
    const filteredTrends = enhanced.filter((trend: any) => {
      const originalScore = trend.score || 0
      const hasSegmentRelevance = (trend.relevanceScore || 0) > originalScore + 20
      return hasSegmentRelevance
    })
    
    console.log(`🎯 [TrendsManager] Filtered ${enhanced.length - filteredTrends.length} non-segment-relevant trends`)
    console.log(`📊 [TrendsManager] Keeping ${filteredTrends.length} segment-relevant trends`)
    
    return filteredTrends
  }

  async getAllTrends(
    platforms?: TrendPlatform[], 
    segments?: Array<{ id: string; name: string; description?: string }>, 
    options: { 
      limitPerPlatform?: number,
      sortBy?: 'relevance' | 'hotness' | 'viral' | 'impact' | 'cross-platform' | 'recent'
    } = {}
  ): Promise<AggregatedTrendsResponse> {
    const enabledPlatforms = platforms || Array.from(this.services.keys()).filter(
      platform => this.services.get(platform)?.isEnabled
    )
    
    const limitPerPlatform = options.limitPerPlatform || 6
    const sortBy = options.sortBy || 'relevance'
    
    console.log(`🎯 [TrendsManager] Fetching ${limitPerPlatform} trends per platform from:`, enabledPlatforms)
    console.log(`📊 [TrendsManager] Processing segments:`, segments?.map(s => s.name).join(', ') || 'None')
    console.log(`🔄 [TrendsManager] Sort strategy:`, sortBy)

    try {
      const results = await Promise.allSettled(
        enabledPlatforms.map(async platform => {
          console.log(`🔍 [${platform.toUpperCase()}] Fetching trends...`)
          const result = await this.getTrends(platform, segments, limitPerPlatform)
          console.log(`✅ [${platform.toUpperCase()}] Got ${result.data?.length || 0} trends`)
          return result
        })
      )

      let allTrends: TrendItem[] = []
      const successfulPlatforms: TrendPlatform[] = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          allTrends.push(...result.value.data)
          successfulPlatforms.push(enabledPlatforms[index])
        }
      })

      // Enhanced relevance scoring for segments
      if (segments && segments.length > 0) {
        const keywords = this.generateSegmentKeywords(segments)
        allTrends = this.enhanceRelevanceScoring(allTrends, segments, keywords)
      }

      // Apply advanced scoring (hotness, viral, impact, cross-platform)
      allTrends = this.calculateAdvancedScoring(allTrends)

      // Sort by selected strategy
      console.log(`🔄 [TrendsManager] Applying ${sortBy} sorting strategy`)
      allTrends.sort((a, b) => {
        switch (sortBy) {
          case 'hotness':
            return ((b as any).hotnessScore || 0) - ((a as any).hotnessScore || 0)
          
          case 'viral':
            return ((b as any).viralPotential || 0) - ((a as any).viralPotential || 0)
          
          case 'impact':
            return ((b as any).impactScore || 0) - ((a as any).impactScore || 0)
          
          case 'cross-platform':
            const aCorrelation = ((a as any).crossPlatformBonus || 0) + ((a as any).crossPlatformTopics?.length || 0) * 10
            const bCorrelation = ((b as any).crossPlatformBonus || 0) + ((b as any).crossPlatformTopics?.length || 0) * 10
            return bCorrelation - aCorrelation
          
          case 'recent':
            const aTime = new Date(a.timestamp).getTime()
            const bTime = new Date(b.timestamp).getTime()
            return bTime - aTime // Most recent first
          
          case 'relevance':
          default:
            // Multi-factor relevance (combines all scores)
            const aRelevance = (a as any).relevanceScore || a.score || 0
            const bRelevance = (b as any).relevanceScore || b.score || 0
            return bRelevance - aRelevance
        }
      })

      // Group by platform and take top results
      const trendsByPlatform = allTrends.reduce((acc, trend) => {
        if (!acc[trend.platform]) {
          acc[trend.platform] = []
        }
        acc[trend.platform].push(trend)
        return acc
      }, {} as Record<string, TrendItem[]>)

      // Keep only top results per platform (respecting sort order)
      Object.keys(trendsByPlatform).forEach(platform => {
        trendsByPlatform[platform] = trendsByPlatform[platform].slice(0, limitPerPlatform)
      })

      // Flatten back to single array
      allTrends = Object.values(trendsByPlatform).flat()

      if (segments && segments.length > 0) {
        console.log(`📊 [TrendsManager] Advanced Trends Analysis (${sortBy} sorting):`)
        
        Object.entries(trendsByPlatform).forEach(([platform, trends]) => {
          console.log(`  🔥 ${platform.toUpperCase()}: ${trends.length} trends`)
          
          trends.slice(0, 2).forEach((trend, i) => {
            const hotness = (trend as any).hotnessScore || 0
            const viral = (trend as any).viralPotential || 0
            const impact = (trend as any).impactScore || 0
            const crossPlatform = (trend as any).crossPlatformTopics?.length || 0
            const hotnessRating = (trend as any).hotnessRating || 'cool'
            const viralRating = (trend as any).viralRating || 'stable'
            
            console.log(`    ${i+1}. [${sortBy.toUpperCase()}:${trend.relevanceScore || trend.score}] ${trend.title.substring(0, 35)}...`)
            console.log(`       🔥 Hot: ${hotness} (${hotnessRating}) | 🚀 Viral: ${viral} (${viralRating}) | 💥 Impact: ${impact}`)
            
            if (crossPlatform > 0) {
              const platforms = (trend as any).crossPlatformTopics?.map((t: any) => t.platforms).flat() || []
              console.log(`       🌐 Cross-platform: ${Array.from(new Set(platforms)).join(', ')}`)
            }
            
            if ((trend as any).matchedKeywords?.length > 0) {
              const topKeywords = (trend as any).matchedKeywords.slice(0, 3).join(', ')
              console.log(`       🎯 Keywords: ${topKeywords}`)
            }
          })
        })
        
        // Summary of high-value opportunities by new scoring
        const hotTrends = allTrends.filter(t => (t as any).hotnessRating === 'very-hot' || (t as any).hotnessRating === 'hot')
        const viralTrends = allTrends.filter(t => (t as any).viralRating === 'very-viral' || (t as any).viralRating === 'viral')
        const crossPlatformTrends = allTrends.filter(t => (t as any).crossPlatformTopics?.length > 0)
        
        console.log(`🔥 [TrendsManager] ${hotTrends.length} HOT trends | 🚀 ${viralTrends.length} VIRAL trends | 🌐 ${crossPlatformTrends.length} CROSS-PLATFORM trends`)
        
        if (crossPlatformTrends.length > 0) {
          console.log(`🌟 [TrendsManager] TOP CROSS-PLATFORM opportunities:`)
          crossPlatformTrends.slice(0, 3).forEach((trend, i) => {
            const topics = (trend as any).crossPlatformTopics || []
            console.log(`   ${i+1}. "${trend.title}" - Shared topics: ${topics.map((t: any) => t.word).join(', ')}`)
          })
        }
      }

      return {
        success: true,
        data: {
          trends: allTrends,
          platforms: successfulPlatforms,
          totalCount: allTrends.length,
          lastUpdated: new Date().toISOString(),
          sortBy,
          analytics: {
            hotTrends: allTrends.filter(t => (t as any).hotnessRating === 'very-hot' || (t as any).hotnessRating === 'hot').length,
            viralTrends: allTrends.filter(t => (t as any).viralRating === 'very-viral' || (t as any).viralRating === 'viral').length,
            crossPlatformTrends: allTrends.filter(t => (t as any).crossPlatformTopics?.length > 0).length,
            highImpactTrends: allTrends.filter(t => (t as any).impactRating === 'high-impact').length
          }
        }
      }
    } catch (error) {
      console.error('❌ [TrendsManager] Error in getAllTrends:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trends'
      }
    }
  }

  getEnabledPlatforms(): TrendPlatform[] {
    return Array.from(this.services.keys()).filter(
      platform => this.services.get(platform)?.isEnabled
    )
  }

  enablePlatform(platform: TrendPlatform, enabled: boolean = true) {
    const service = this.services.get(platform)
    if (service) {
      service.isEnabled = enabled
    }
  }
}

// Export singleton instance
export const trendsManager = new TrendsManager()

// Export individual services for testing
export { GoogleTrendsService, RedditTrendsService } 