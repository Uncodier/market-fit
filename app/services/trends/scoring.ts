import type { TrendItem } from '@/app/types/trends'

export function calculateAdvancedScoring(allTrends: TrendItem[]): TrendItem[] {

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
    .filter(([, data]) => data.platforms.size >= 2) // Appears on 2+ platforms
    .map(([word, data]) => ({
      word,
      platformCount: data.platforms.size,
      trends: data.trends,
      crossPlatformBonus: data.platforms.size * 15 // Bonus for cross-platform presence
    }))

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
    const originalRelevance = trend.relevanceScore || trend.score || 0

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
