import type { RequestSegment } from './request-normalization'

export function generateRedditKeywords(segments?: RequestSegment[]): string[] {
  if (!segments || segments.length === 0) {
    // Default keywords for general business/tech discussions
    return [
      'startup', 'business', 'entrepreneur', 'marketing', 'technology',
      'SaaS', 'digital marketing', 'growth hacking', 'productivity'
    ]
  }


  const keywords: string[] = []
  const redditContexts = ['tips', 'advice', 'tools', 'strategy', 'success', 'growth', 'help', 'guide', 'best', 'how']
  const stopWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'were', 'been', 'have', 'their', 'would', 'could', 'should', 'which', 'where', 'there', 'what', 'when', 'will', 'can', 'are', 'is', 'was', 'by', 'an', 'as', 'at', 'be', 'or', 'in', 'on', 'of', 'to']

  segments.forEach(segment => {

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

  return uniqueKeywords
}
