import { NextRequest, NextResponse } from 'next/server'

// Simple HTML cleaning function directly in this file
function cleanHtmlContent(htmlString: string): string {
  console.log('🧽 [INLINE cleanHtmlContent] Input:', htmlString?.substring(0, 100))
  
  if (!htmlString || typeof htmlString !== 'string') return ''
  
  let cleaned = htmlString.trim()
  
  // Handle CDATA sections first
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
  
  console.log('✨ [INLINE cleanHtmlContent] Output:', cleaned)
  return cleaned
}

function cleanNewsTitle(title: string): string {
  console.log('📰 [INLINE cleanNewsTitle] Input:', title)
  
  if (!title || typeof title !== 'string') return ''
  
  let cleaned = title.trim()
  
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '')
  
  // Clean entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
  
  // Remove source attribution
  cleaned = cleaned.replace(/\s*[-–—]\s*[A-Za-z\s]+\s*$/g, '')
  
  // Normalize whitespace  
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  console.log('📰 [INLINE cleanNewsTitle] Output:', cleaned)
  return cleaned
}

function isValidCleanedContent(content: string): boolean {
  if (!content || content.length < 10) return false
  const words = content.split(/\s+/).filter(word => word.length > 2)
  return words.length >= 3
}

// Legacy function kept for compatibility - now uses enhanced cleaning utility
function cleanHtmlContentLegacy(htmlString: string): string {
  if (!htmlString || typeof htmlString !== 'string') return ''
  
  let cleaned = htmlString.trim()
  
  // Step 1: Handle CDATA sections first
  cleaned = cleaned.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
  
  // Step 2: Extract text from common HTML elements before removing them
  // Extract text from <a> tags (preserve the link text)
  cleaned = cleaned.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
  
  // Extract text from <b>, <strong>, <i>, <em> tags
  cleaned = cleaned.replace(/<(b|strong|i|em)[^>]*>(.*?)<\/\1>/gi, '$2')
  
  // Extract text from header tags
  cleaned = cleaned.replace(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi, '$2')
  
  // Extract text from paragraph tags
  cleaned = cleaned.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1 ')
  
  // Extract text from div and span tags
  cleaned = cleaned.replace(/<(div|span)[^>]*>(.*?)<\/\1>/gi, '$2 ')
  
  // Step 3: Remove problematic tags completely (including content)
  // Remove font tags (often contain source attribution we don't want)
  cleaned = cleaned.replace(/<font[^>]*>.*?<\/font>/gi, '')
  
  // Remove script and style tags with their content
  cleaned = cleaned.replace(/<(script|style)[^>]*>.*?<\/\1>/gi, '')
  
  // Remove comments
  cleaned = cleaned.replace(/<!--.*?-->/g, '')
  
  // Step 4: Remove all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '')
  
  // Step 5: Clean HTML entities (comprehensive list)
  const htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&deg;': '°',
    '&plusmn;': '±',
    '&frac14;': '¼',
    '&frac12;': '½',
    '&frac34;': '¾'
  }
  
  // Replace known entities
  Object.entries(htmlEntities).forEach(([entity, replacement]) => {
    cleaned = cleaned.replace(new RegExp(entity, 'g'), replacement)
  })
  
  // Handle numeric character references (&#123; or &#x1A;)
  cleaned = cleaned.replace(/&#(\d+);/g, (match, num) => {
    try {
      return String.fromCharCode(parseInt(num, 10))
    } catch {
      return ''
    }
  })
  
  // Handle hexadecimal character references
  cleaned = cleaned.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16))
    } catch {
      return ''
    }
  })
  
  // Remove any remaining unrecognized entities
  cleaned = cleaned.replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, '')
  
  // Step 6: Remove URLs and links
  cleaned = cleaned.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g, '')
  cleaned = cleaned.replace(/www\.[^\s<>"{}|\\^`[\]]+\.[a-z]{2,}/gi, '')
  
  // Step 7: Clean up source attribution patterns
  // Remove common source patterns like "- Source Name", "via SourceName", etc.
  cleaned = cleaned.replace(/\s*[-–—]\s*[A-Za-z][A-Za-z\s&.,]+\s*$/g, '')
  cleaned = cleaned.replace(/^\s*[-–—]\s*/g, '')
  cleaned = cleaned.replace(/\s*via\s+[A-Za-z][A-Za-z\s&.,]+$/gi, '')
  cleaned = cleaned.replace(/\s*source:\s*[A-Za-z][A-Za-z\s&.,]+$/gi, '')
  cleaned = cleaned.replace(/\s*\|\s*[A-Za-z][A-Za-z\s&.,]+$/g, '')
  
  // Step 8: Normalize whitespace and special characters
  // Replace multiple spaces/tabs/newlines with single space
  cleaned = cleaned.replace(/[\s\r\n\t]+/g, ' ')
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim()
  
  // Step 9: Remove common unwanted phrases
  const unwantedPhrases = [
    /read more\.?\.?\.?$/gi,
    /continue reading\.?\.?\.?$/gi,
    /click here\.?\.?\.?$/gi,
    /full story\.?\.?\.?$/gi,
    /more details\.?\.?\.?$/gi,
    /see full article\.?\.?\.?$/gi
  ]
  
  unwantedPhrases.forEach(phrase => {
    cleaned = cleaned.replace(phrase, '')
  })
  
  // Step 10: Final cleanup
  cleaned = cleaned.trim()
  
  // Ensure we don't have just punctuation or very short meaningless content
  if (cleaned.length < 3 || /^[^\w]*$/.test(cleaned)) {
    return ''
  }
  
  // Limit maximum length to prevent extremely long descriptions
  if (cleaned.length > 500) {
    cleaned = cleaned.substring(0, 500).trim()
    // Try to end at a word boundary
    const lastSpace = cleaned.lastIndexOf(' ')
    if (lastSpace > 400) {
      cleaned = cleaned.substring(0, lastSpace)
    }
    cleaned += '...'
  }
  
  return cleaned
}

// Real Google News RSS implementation - no API key needed!
async function fetchGoogleNews(query: string, limit: number = 10): Promise<any[]> {
  try {
    const encodedQuery = encodeURIComponent(query)
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en&gl=US&ceid=US:en`
    
    console.log(`📰 [Google News RSS] Fetching: ${query}`)
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsReader/1.0)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Google News RSS failed: ${response.status}`)
    }
    
    const xmlText = await response.text()
    
    // Parse RSS XML to extract news items
    const newsItems = parseRSSFeed(xmlText, limit)
    
    return newsItems
  } catch (error) {
    console.error(`❌ [Google News RSS] Error fetching ${query}:`, error)
    return []
  }
}

// Parse RSS XML and extract news items
function parseRSSFeed(xmlText: string, limit: number): any[] {
  const items: any[] = []
  
  try {
    // Extract items using regex (simple XML parsing)
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/g) || []
    
    for (let i = 0; i < Math.min(itemMatches.length, limit); i++) {
      const item = itemMatches[i]
      
      // Extract title and clean HTML using our enhanced cleaning functions
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/)
      const rawTitle = titleMatch ? titleMatch[1] : `News Update ${i + 1}`
      
      console.log(`🔍 [Google News RSS] Item ${i + 1} Raw Title:`, rawTitle)
      const title = cleanNewsTitle(rawTitle)
      console.log(`✨ [Google News RSS] Item ${i + 1} Cleaned Title:`, title)
      
            // Extract description/summary from multiple possible sources and clean with our robust function
      let rawDescription = ''
      
      // Try to get from description field
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/)
      if (descMatch) {
        rawDescription = descMatch[1]
      }
      
      // Try to get from summary field if description is empty
      if (!rawDescription || rawDescription.length < 20) {
        const summaryMatch = item.match(/<summary><!\[CDATA\[(.*?)\]\]><\/summary>/) || item.match(/<summary>(.*?)<\/summary>/)
        if (summaryMatch) {
          rawDescription = summaryMatch[1]
        }
      }
      
      // Try to get from content:encoded if still empty
      if (!rawDescription || rawDescription.length < 20) {
        const contentMatch = item.match(/<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>/)
        if (contentMatch) {
          rawDescription = contentMatch[1]
        }
      }
      
      // Clean the description using our enhanced cleaning function
      console.log(`🔍 [Google News RSS] Item ${i + 1} Raw Description:`, rawDescription)
      let description = cleanHtmlContent(rawDescription)
      console.log(`✨ [Google News RSS] Item ${i + 1} Cleaned Description:`, description)
      
      // Validate the cleaned description quality
      if (!isValidCleanedContent(description)) {
        // Try extracting from title or use a more conservative approach
        const fallbackDescription = cleanHtmlContent(rawTitle.substring(0, 200))
        
        if (isValidCleanedContent(fallbackDescription)) {
          description = fallbackDescription
        } else {
          // Create a meaningful fallback based on title
          description = `Latest ${categorizeNews(title, '')} news - ${title.substring(0, 100)}${title.length > 100 ? '...' : ''}`
        }
      }
      
      // Ensure description doesn't exceed 300 characters (already handled in cleanHtmlContent)
      if (description.length > 300) {
        description = description.substring(0, 300).trim()
        const lastSpace = description.lastIndexOf(' ')
        if (lastSpace > 250) {
          description = description.substring(0, lastSpace) + '...'
        }
      }
      
      // Extract link
      const linkMatch = item.match(/<link>(.*?)<\/link>/)
      const link = linkMatch ? linkMatch[1] : ''
      
      // Extract publication date
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)
      const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString()
      
      // Extract source from title, link, or use clean extraction
      let source = 'Google News'
      
      // Try to extract from original title before cleaning
      const originalTitle = titleMatch ? titleMatch[1] : ''
      const sourceFontMatch = originalTitle.match(/<font[^>]*>(.*?)<\/font>/i)
      if (sourceFontMatch) {
        source = cleanNewsTitle(sourceFontMatch[1])
      } else {
        // Fallback to link domain
        const linkMatch = link.match(/\/\/(?:www\.)?([^\/]+)/)
        if (linkMatch) {
          source = linkMatch[1].replace(/\.(com|org|net|edu|gov).*$/, '')
          source = source.charAt(0).toUpperCase() + source.slice(1) // Capitalize
        }
      }
      
      // Additional cleaning for source name
      if (source && source !== 'Google News') {
        source = source
          .replace(/\.(com|org|net|edu|gov).*$/i, '') // Remove domain extensions
          .trim()
        
        // Capitalize first letter if it's not already
        if (source.length > 0) {
          source = source.charAt(0).toUpperCase() + source.slice(1)
        }
      }
      
      // Calculate relevance score based on recency and keywords
      const hoursAgo = (Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60)
      const freshnessScore = Math.max(100 - hoursAgo * 2, 20) // Newer = higher score
      const relevanceScore = Math.floor(freshnessScore + Math.random() * 20)
      
      items.push({
        title: title, // Title is already cleaned
        headline: title,
        description,
        snippet: description,
        summary: description,
        category: categorizeNews(title, description),
        section: 'Technology',
        tags: extractTags(title, description),
        keywords: extractTags(title, description),
        url: link,
        link,
        source: source, // Source is already cleaned
        publisher: source,
        published_at: pubDate,
        relevance_score: relevanceScore,
        engagement: Math.floor(Math.random() * 100) + 50,
        trend_change: (Math.random() - 0.5) * 10, // -5% to +5% for news
        is_breaking: hoursAgo < 2, // Breaking if less than 2 hours old
        news_type: 'real_news'
      })
    }
    
    console.log(`✅ [Google News RSS] Parsed ${items.length} real news items`)
    return items
    
  } catch (error) {
    console.error('❌ [Google News RSS] Parse error:', error)
    return []
  }
}

// Categorize news based on content
function categorizeNews(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase()
  
  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) {
    return 'AI & Technology'
  }
  if (text.includes('startup') || text.includes('funding') || text.includes('venture')) {
    return 'Startups & Funding'
  }
  if (text.includes('saas') || text.includes('software') || text.includes('platform')) {
    return 'Software & SaaS'
  }
  if (text.includes('marketing') || text.includes('sales') || text.includes('customer')) {
    return 'Marketing & Sales'
  }
  if (text.includes('crypto') || text.includes('blockchain') || text.includes('bitcoin')) {
    return 'Crypto & Blockchain'
  }
  if (text.includes('acquisition') || text.includes('merger') || text.includes('ipo')) {
    return 'Mergers & Acquisitions'
  }
  
  return 'Business & Technology'
}

// Extract relevant tags from news content
function extractTags(title: string, description: string): string[] {
  const text = (title + ' ' + description).toLowerCase()
  const tags: string[] = []
  
  // Technology tags
  if (text.includes('ai')) tags.push('AI')
  if (text.includes('machine learning')) tags.push('Machine Learning')
  if (text.includes('saas')) tags.push('SaaS')
  if (text.includes('startup')) tags.push('Startup')
  if (text.includes('funding')) tags.push('Funding')
  if (text.includes('marketing')) tags.push('Marketing')
  if (text.includes('software')) tags.push('Software')
  if (text.includes('platform')) tags.push('Platform')
  if (text.includes('automation')) tags.push('Automation')
  if (text.includes('cloud')) tags.push('Cloud')
  
  // Business tags
  if (text.includes('revenue')) tags.push('Revenue')
  if (text.includes('growth')) tags.push('Growth')
  if (text.includes('acquisition')) tags.push('Acquisition')
  if (text.includes('ipo')) tags.push('IPO')
  if (text.includes('investment')) tags.push('Investment')
  
  // Add general tags
  tags.push('Business', 'Technology')
  
  return Array.from(new Set(tags)).slice(0, 5) // Max 5 unique tags
}

// Generate search queries from segments
function generateSearchQueries(segments: any[]): string[] {
  if (!segments || segments.length === 0) {
    return [
      'startup funding news',
      'saas platform news',
      'AI technology breakthrough',
      'business automation tools',
      'marketing technology news'
    ]
  }
  
  const queries: string[] = []
  
  segments.forEach(segment => {
    const name = segment.name.toLowerCase()
    
    // Core segment queries
    queries.push(`${segment.name} news`)
    queries.push(`${segment.name} technology`)
    queries.push(`${segment.name} startup`)
    
    // Business context queries
    if (name.includes('marketing')) {
      queries.push('marketing automation news', 'martech startup funding')
    }
    if (name.includes('sales')) {
      queries.push('sales technology news', 'CRM platform news')
    }
    if (name.includes('saas') || name.includes('software')) {
      queries.push('SaaS startup news', 'B2B software funding')
    }
    if (name.includes('ai') || name.includes('automation')) {
      queries.push('AI business automation', 'machine learning startup')
    }
    if (name.includes('ecommerce') || name.includes('retail')) {
      queries.push('ecommerce technology news', 'retail automation')
    }
    
    // Add industry news
    queries.push(`${segment.name} industry news`)
    queries.push(`${segment.name} market trends`)
  })
  
  // Remove duplicates and return top queries
  return Array.from(new Set(queries)).slice(0, 8)
}

export async function POST(request: NextRequest) {
  console.log('🚨 [Google News RSS] API CALLED - POST REQUEST RECEIVED!')
  
  try {
    const { geo = 'US', hl = 'en', timeframe = 'now 1-d', limit = 10, segments, mode = 'news' } = await request.json()

    console.log(`🎯 [Google News RSS] Request params:`, { geo, timeframe, limit, segmentCount: segments?.length || 0 })

    // Generate search queries from segments
    const searchQueries = generateSearchQueries(segments)
    console.log(`🔍 [Google News RSS] Search queries:`, searchQueries)

    // Fetch news from multiple queries
    const allNews: any[] = []
    const itemsPerQuery = Math.ceil(limit / searchQueries.length)

    for (const query of searchQueries) {
      const newsItems = await fetchGoogleNews(query, itemsPerQuery)
      allNews.push(...newsItems)
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Remove duplicates by title and sort by relevance
    const uniqueNews = allNews
      .filter((item, index, self) => 
        index === self.findIndex(other => other.title === item.title)
      )
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit)

    console.log(`✅ [Google News RSS] Returning ${uniqueNews.length} real news items`)
    console.log(`📰 [Google News RSS] Sample headlines:`, uniqueNews.slice(0, 2).map(n => n.title))
    console.log(`🔍 [Google News RSS] Sample full items:`, JSON.stringify(uniqueNews.slice(0, 2), null, 2))

      return NextResponse.json({
        success: true,
      trends: uniqueNews,
        metadata: {
          geo,
          hl,
          timeframe,
          timestamp: new Date().toISOString(),
        source: 'google-news-rss-real',
        mode: 'news',
        queryCount: searchQueries.length,
        note: 'Real news data from Google News RSS feed'
      }
    })

  } catch (error) {
    console.error('❌ [Google News RSS] API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Google News data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 