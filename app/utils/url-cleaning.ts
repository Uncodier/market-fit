/**
 * Utility functions for cleaning and processing URLs
 */

/**
 * Extracts URLs from text content
 */
export const extractUrlsFromText = (text: string): string[] => {
  if (!text) return []
  
  // Use a single comprehensive regex pattern to avoid duplicates
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}[^\s<>"{}|\\^`[\]]*/gi
  
  const allMatches = text.match(urlPattern) || []
  
  // Remove duplicates and clean URLs
  const uniqueUrls = Array.from(new Set(allMatches))
  
  return uniqueUrls.map(url => {
    // Only remove trailing punctuation that is clearly not part of the URL
    // Be very conservative to preserve query parameters and paths
    // Only remove periods, commas, semicolons, and closing brackets/parentheses at the end
    // Preserve ? (query params), = (query values), & (query separators), / (paths), # (fragments)
    let cleanedUrl = url.replace(/[.,;)\]}>]+$/, '')
    
    // Remove trailing punctuation only if it's clearly sentence punctuation
    // Don't remove ?, =, &, /, # as these are legitimate URL characters
    cleanedUrl = cleanedUrl.replace(/[.,;)\]}>](?=\s|$)/g, '')
    
    // Add protocol if missing
    if (!cleanedUrl.match(/^https?:\/\//)) {
      cleanedUrl = `https://${cleanedUrl}`
    }
    
    return cleanedUrl
  }).filter(url => {
    // Basic validation: must have at least a domain with TLD
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.includes('.') && urlObj.hostname.length > 3
    } catch {
      return false
    }
  })
}

/**
 * Generates a title from a URL that includes both domain and path information
 */
export const generateTitleFromUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.replace('www.', '')
    
    // Get the main domain name (first part before TLD)
    const domainParts = hostname.split('.')
    const mainDomain = domainParts[0]
    const domainName = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1).toLowerCase()
    
    // Extract meaningful parts from pathname
    const pathParts = parsedUrl.pathname.split('/').filter(part => part && part !== '')
    
    if (pathParts.length > 0) {
      // Use the last meaningful part of the path
      const lastPart = pathParts[pathParts.length - 1]
      const cleaned = lastPart.replace(/[-_]/g, ' ').replace(/\.(html|php|aspx?)$/i, '')
      const pathTitle = cleaned.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
      
      // Combine domain and path: "Calendly, Sergio Prado"
      return `${domainName}, ${pathTitle}`
    }
    
    // Fallback to just domain name if no meaningful path
    return domainName
  } catch {
    return 'Visit Link'
  }
}
