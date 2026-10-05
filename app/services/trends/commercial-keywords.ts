import type { TrendSegment } from '@/app/types/trends'

export function generateCommercialKeywords(segments?: TrendSegment[]): string[] {
  if (!segments || segments.length === 0) {
    return [
      'digital marketing', 'business growth', 'startup trends', 'technology innovation',
      'marketing automation', 'customer acquisition', 'business intelligence'
    ]
  }


  const keywords: string[] = []
  const commercialContexts = ['trends', 'news', 'breakthrough', 'innovation', 'solution', 'tool', 'strategy', 'growth', 'success', 'tips', 'guide', 'review', 'comparison', 'alternatives']
  const stopWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'were', 'been', 'have', 'their', 'would', 'could', 'should', 'which', 'where', 'there', 'what', 'when', 'will', 'can', 'are', 'is', 'was', 'by', 'an', 'as', 'at', 'be', 'or', 'in', 'on', 'of', 'to']

  segments.forEach(segment => {

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
    if (segment.audience) {
      const audienceType = segment.audience
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

  return uniqueKeywords
}
