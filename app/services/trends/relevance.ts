import type { TrendItem, TrendSegment } from '@/app/types/trends'

export function enhanceRelevanceScoring(trends: TrendItem[], segments: TrendSegment[], keywords: string[]): TrendItem[] {

  const enhanced = trends.map(trend => {
    let relevanceScore = trend.score || 0
    const matchedKeywords: string[] = []
    const commercialSignals: string[] = []

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
  const filteredTrends = enhanced.filter((trend) => {
    const originalScore = trend.score || 0
    const hasSegmentRelevance = (trend.relevanceScore || 0) > originalScore + 20
    return hasSegmentRelevance
  })


  return filteredTrends
}
