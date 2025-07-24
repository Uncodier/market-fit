/**
 * Comprehensive text cleaning utilities for RSS feeds and HTML content
 */

/**
 * Advanced HTML content cleaner that removes all HTML tags, entities, and unwanted content
 * Specifically designed for cleaning Google News RSS feed content
 */
export function cleanHtmlContent(htmlString: string): string {
  console.log('🧽 [cleanHtmlContent] Input:', htmlString?.substring(0, 100) + (htmlString?.length > 100 ? '...' : ''))
  
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
  
  // Step 5: Clean HTML entities
  cleaned = cleanHtmlEntities(cleaned)
  
  // Step 6: Remove URLs and links
  cleaned = removeUrls(cleaned)
  
  // Step 7: Clean up source attribution patterns
  cleaned = removeSourceAttribution(cleaned)
  
  // Step 8: Normalize whitespace and special characters
  cleaned = normalizeWhitespace(cleaned)
  
  // Step 9: Remove common unwanted phrases
  cleaned = removeUnwantedPhrases(cleaned)
  
  // Step 10: Final cleanup and validation
  cleaned = finalCleanup(cleaned)
  
  console.log('✨ [cleanHtmlContent] Output:', cleaned)
  return cleaned
}

/**
 * Clean HTML entities with comprehensive entity mapping
 */
function cleanHtmlEntities(text: string): string {
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
    '&frac34;': '¾',
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥',
    '&sect;': '§',
    '&para;': '¶',
    '&dagger;': '†',
    '&Dagger;': '‡',
    '&bull;': '•',
    '&prime;': '′',
    '&Prime;': '″',
    '&lsaquo;': '‹',
    '&rsaquo;': '›',
    '&oline;': '‾',
    '&frasl;': '⁄',
    '&weierp;': '℘',
    '&image;': 'ℑ',
    '&real;': 'ℜ',
    '&alefsym;': 'ℵ',
    '&larr;': '←',
    '&uarr;': '↑',
    '&rarr;': '→',
    '&darr;': '↓',
    '&harr;': '↔',
    '&crarr;': '↵',
    '&lArr;': '⇐',
    '&uArr;': '⇑',
    '&rArr;': '⇒',
    '&dArr;': '⇓',
    '&hArr;': '⇔'
  }
  
  let cleaned = text
  
  // Replace known entities
  Object.entries(htmlEntities).forEach(([entity, replacement]) => {
    cleaned = cleaned.replace(new RegExp(entity, 'g'), replacement)
  })
  
  // Handle numeric character references (&#123;)
  cleaned = cleaned.replace(/&#(\d+);/g, (match, num) => {
    try {
      const code = parseInt(num, 10)
      // Only convert printable characters
      if (code > 31 && code < 127) {
        return String.fromCharCode(code)
      }
      // For Unicode characters, be selective
      if (code >= 160 && code <= 255) {
        return String.fromCharCode(code)
      }
      return ''
    } catch {
      return ''
    }
  })
  
  // Handle hexadecimal character references (&#x1A;)
  cleaned = cleaned.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    try {
      const code = parseInt(hex, 16)
      // Only convert printable characters
      if (code > 31 && code < 127) {
        return String.fromCharCode(code)
      }
      // For Unicode characters, be selective
      if (code >= 160 && code <= 255) {
        return String.fromCharCode(code)
      }
      return ''
    } catch {
      return ''
    }
  })
  
  // Remove any remaining unrecognized entities
  cleaned = cleaned.replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, '')
  
  return cleaned
}

/**
 * Remove URLs and web links from text
 */
function removeUrls(text: string): string {
  let cleaned = text
  
  // Remove HTTP/HTTPS URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g, '')
  
  // Remove www URLs
  cleaned = cleaned.replace(/www\.[^\s<>"{}|\\^`[\]]+\.[a-z]{2,}/gi, '')
  
  // Remove FTP URLs
  cleaned = cleaned.replace(/ftp:\/\/[^\s<>"{}|\\^`[\]]+/g, '')
  
  // Remove email addresses
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
  
  return cleaned
}

/**
 * Remove source attribution patterns
 */
function removeSourceAttribution(text: string): string {
  let cleaned = text
  
  // Remove common source patterns like "- Source Name", "via SourceName", etc.
  const sourcePatterns = [
    /\s*[-–—]\s*[A-Za-z][A-Za-z\s&.,]+\s*$/g,
    /^\s*[-–—]\s*/g,
    /\s*via\s+[A-Za-z][A-Za-z\s&.,]+$/gi,
    /\s*source:\s*[A-Za-z][A-Za-z\s&.,]+$/gi,
    /\s*\|\s*[A-Za-z][A-Za-z\s&.,]+$/g,
    /\s*by\s+[A-Za-z][A-Za-z\s&.,]+$/gi,
    /\s*from\s+[A-Za-z][A-Za-z\s&.,]+$/gi,
    /\s*according\s+to\s+[A-Za-z][A-Za-z\s&.,]+$/gi,
    /\s*reports?\s+[A-Za-z][A-Za-z\s&.,]+$/gi
  ]
  
  sourcePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })
  
  return cleaned
}

/**
 * Normalize whitespace and special characters
 */
function normalizeWhitespace(text: string): string {
  let cleaned = text
  
  // Replace multiple spaces/tabs/newlines with single space
  cleaned = cleaned.replace(/[\s\r\n\t]+/g, ' ')
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim()
  
  // Normalize quotes
  cleaned = cleaned.replace(/[""]/g, '"')
  cleaned = cleaned.replace(/['']/g, "'")
  
  // Normalize dashes
  cleaned = cleaned.replace(/[–—]/g, '-')
  
  // Remove zero-width characters
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '')
  
  return cleaned
}

/**
 * Remove common unwanted phrases
 */
function removeUnwantedPhrases(text: string): string {
  const unwantedPhrases = [
    /read\s+more\.?\.?\.?$/gi,
    /continue\s+reading\.?\.?\.?$/gi,
    /click\s+here\.?\.?\.?$/gi,
    /full\s+story\.?\.?\.?$/gi,
    /more\s+details\.?\.?\.?$/gi,
    /see\s+full\s+article\.?\.?\.?$/gi,
    /learn\s+more\.?\.?\.?$/gi,
    /find\s+out\s+more\.?\.?\.?$/gi,
    /get\s+the\s+full\s+story\.?\.?\.?$/gi,
    /read\s+the\s+full\s+article\.?\.?\.?$/gi
  ]
  
  let cleaned = text
  unwantedPhrases.forEach(phrase => {
    cleaned = cleaned.replace(phrase, '')
  })
  
  return cleaned
}

/**
 * Final cleanup and validation
 */
function finalCleanup(text: string): string {
  let cleaned = text.trim()
  
  // Ensure we don't have just punctuation or very short meaningless content
  if (cleaned.length < 3 || /^[^\w]*$/.test(cleaned)) {
    return ''
  }
  
  // Remove standalone punctuation at the beginning or end
  cleaned = cleaned.replace(/^[.,;:!?]+\s*/, '')
  cleaned = cleaned.replace(/\s*[.,;:!?]+$/, '')
  
  // Limit maximum length to prevent extremely long descriptions
  if (cleaned.length > 500) {
    cleaned = cleaned.substring(0, 500).trim()
    // Try to end at a word boundary
    const lastSpace = cleaned.lastIndexOf(' ')
    if (lastSpace > 400) {
      cleaned = cleaned.substring(0, lastSpace)
    }
    // Only add ellipsis if we actually cut off content
    if (cleaned.length < 500) {
      cleaned += '...'
    }
  }
  
  return cleaned.trim()
}

/**
 * Extract clean text from potentially mixed HTML/text content
 * Alternative method that's more conservative
 */
export function extractCleanText(content: string): string {
  if (!content || typeof content !== 'string') return ''
  
  // If content doesn't contain HTML tags, just clean entities and normalize
  if (!/<[^>]+>/.test(content)) {
    let cleaned = cleanHtmlEntities(content)
    cleaned = normalizeWhitespace(cleaned)
    cleaned = removeUrls(cleaned)
    cleaned = finalCleanup(cleaned)
    return cleaned
  }
  
  // Otherwise, use full HTML cleaning
  return cleanHtmlContent(content)
}

/**
 * Clean news titles specifically
 */
export function cleanNewsTitle(title: string): string {
  console.log('📰 [cleanNewsTitle] Input:', title)
  
  if (!title || typeof title !== 'string') return ''
  
  let cleaned = title.trim()
  
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '')
  
  // Clean entities
  cleaned = cleanHtmlEntities(cleaned)
  
  // Remove source attribution from titles
  cleaned = removeSourceAttribution(cleaned)
  
  // Normalize whitespace
  cleaned = normalizeWhitespace(cleaned)
  
  // Remove unwanted title patterns
  cleaned = cleaned.replace(/^\[.*?\]\s*/, '') // Remove [Category] prefixes
  cleaned = cleaned.replace(/\s*-\s*[A-Z]{2,}\s*$/, '') // Remove - CNN style suffixes
  
  const result = finalCleanup(cleaned)
  console.log('📰 [cleanNewsTitle] Output:', result)
  return result
}

/**
 * Validate cleaned content quality
 */
export function isValidCleanedContent(content: string): boolean {
  if (!content || content.length < 10) return false
  
  // Check if content is mostly HTML entities or special characters
  const specialCharRatio = (content.match(/[^\w\s.,!?-]/g) || []).length / content.length
  if (specialCharRatio > 0.3) return false
  
  // Check if content has meaningful words
  const words = content.split(/\s+/).filter(word => word.length > 2)
  if (words.length < 3) return false
  
  return true
} 