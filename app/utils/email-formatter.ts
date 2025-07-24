/**
 * Email formatting utilities for MIME multipart messages
 */

import { cleanHtmlContent, extractCleanText } from './text-cleaning'

export interface EmailPart {
  contentType: string
  content: string
  encoding?: string
}

export interface ParsedEmail {
  hasMultipart: boolean
  textPlain?: string
  textHtml?: string
  cleanText: string
  originalFormat?: string
}

/**
 * Detect if a message is a MIME multipart email
 */
export function isMimeMultipartMessage(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  
  // Check for MIME multipart boundaries (more specific pattern)
  const hasMimeBoundary = /--[A-Za-z0-9_=-]{10,}/i.test(text)
  const hasContentType = /Content-Type:\s*(text\/plain|text\/html)/i.test(text)
  const hasContentTransferEncoding = /Content-Transfer-Encoding:/i.test(text)
  
  // Must have all three components for a valid MIME multipart message
  return hasMimeBoundary && hasContentType && hasContentTransferEncoding
}

/**
 * Parse MIME multipart email message
 */
export function parseMimeMultipartMessage(text: string): ParsedEmail {
  console.log('📧 [parseMimeMultipartMessage] Parsing email...')
  
  if (!isMimeMultipartMessage(text)) {
    return {
      hasMultipart: false,
      cleanText: text
    }
  }

  // Extract boundary from the first line
  const boundaryMatch = text.match(/--([A-Za-z0-9_=-]+)/)
  if (!boundaryMatch) {
    return {
      hasMultipart: false,
      cleanText: text
    }
  }

  const boundary = boundaryMatch[1]
  console.log('📧 Found boundary:', boundary)

  let textPlain: string | undefined
  let textHtml: string | undefined

  // Handle production format where everything is in one line
  // Try to extract content between charset=utf-8 and the next boundary for text/plain
  const plainTextMatch = text.match(/Content-Type:\s*text\/plain[^]*?charset=utf-8\s+(.+?)(?=\s+--[A-Za-z0-9_=-]{10,})/i)
  if (plainTextMatch) {
    textPlain = plainTextMatch[1].trim()
    console.log('📧 Plain text extracted (production format):', textPlain.substring(0, 100) + '...')
  }

  // Try to extract HTML content
  const htmlMatch = text.match(/Content-Type:\s*text\/html[^]*?charset=utf-8\s+(.+?)(?=\s+--[A-Za-z0-9_=-]{10,}|$)/i)
  if (htmlMatch) {
    textHtml = htmlMatch[1].trim()
    console.log('📧 HTML content extracted')
  }

  // If the above didn't work, try the traditional split method
  if (!textPlain && !textHtml) {
    const parts = text.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    
    // Process each part
    for (const part of parts) {
      const trimmedPart = part.trim()
      if (!trimmedPart || trimmedPart === '--') continue

      // Extract headers and content
      const headerBodySplit = trimmedPart.split(/\r?\n\r?\n/)
      if (headerBodySplit.length < 2) continue

      const headers = headerBodySplit[0]
      const body = headerBodySplit.slice(1).join('\n\n')

      // Check content type
      const contentTypeMatch = headers.match(/Content-Type:\s*(text\/(?:plain|html))/i)
      if (!contentTypeMatch) continue

      const contentType = contentTypeMatch[1].toLowerCase()
      const encoding = headers.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1] || 'none'

      console.log('📧 Processing part:', contentType, 'encoding:', encoding)

      // Decode content based on encoding
      let decodedContent = body
      if (encoding.toLowerCase() === 'quoted-printable') {
        decodedContent = decodeQuotedPrintable(body)
      }

      // Store based on content type
      if (contentType === 'text/plain') {
        textPlain = decodedContent.trim()
      } else if (contentType === 'text/html') {
        textHtml = decodedContent.trim()
      }
    }
  }

  // Generate clean text - prefer plain text, fallback to simple HTML cleaning
  let cleanText = ''
  if (textPlain) {
    // For emails, preserve the full plain text content
    cleanText = textPlain
  } else if (textHtml) {
    // Simple HTML cleaning without aggressive truncation
    cleanText = simpleHtmlClean(textHtml)
  }

  console.log('📧 Parsed email result:', { 
    hasPlain: !!textPlain, 
    hasHtml: !!textHtml, 
    cleanLength: cleanText.length 
  })

  return {
    hasMultipart: true,
    textPlain,
    textHtml,
    cleanText,
    originalFormat: 'mime-multipart'
  }
}

/**
 * Simple HTML cleaning for email content without aggressive truncation
 */
function simpleHtmlClean(html: string): string {
  let cleaned = html
  
  // Remove HTML tags but preserve content
  cleaned = cleaned.replace(/<[^>]*>/g, '')
  
  // Decode basic HTML entities
  cleaned = cleaned.replace(/&amp;/g, '&')
  cleaned = cleaned.replace(/&lt;/g, '<')
  cleaned = cleaned.replace(/&gt;/g, '>')
  cleaned = cleaned.replace(/&quot;/g, '"')
  cleaned = cleaned.replace(/&apos;/g, "'")
  cleaned = cleaned.replace(/&nbsp;/g, ' ')
  
  // Normalize whitespace but preserve line breaks
  cleaned = cleaned.replace(/\r\n/g, '\n')
  cleaned = cleaned.replace(/\r/g, '\n')
  cleaned = cleaned.replace(/[ \t]+/g, ' ')
  cleaned = cleaned.replace(/\n[ \t]+/g, '\n')
  cleaned = cleaned.replace(/[ \t]+\n/g, '\n')
  
  return cleaned.trim()
}

/**
 * Remove email headers from simple email messages
 */
function removeEmailHeaders(text: string): string {
  const lines = text.split('\n')
  let contentStartIndex = 0
  
  // Find where the email content starts (after headers)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Check if this line looks like an email header
    if (line.match(/^(From|To|Subject|Date|Content-Type|Content-Transfer-Encoding):/i)) {
      continue
    }
    
    // Empty line usually separates headers from content
    if (line === '') {
      contentStartIndex = i + 1
      break
    }
    
    // If we hit a line that doesn't look like a header, assume content starts here
    if (!line.match(/^[A-Z][A-Za-z-]*:\s/)) {
      contentStartIndex = i
      break
    }
  }
  
  // Return the content part
  return lines.slice(contentStartIndex).join('\n').trim()
}

/**
 * Decode quoted-printable encoding
 */
function decodeQuotedPrintable(text: string): string {
  return text
    // Replace =XX hex sequences with actual characters
    .replace(/=([0-9A-F]{2})/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16))
    })
    // Replace soft line breaks (=\n)
    .replace(/=\r?\n/g, '')
    // Replace hard line breaks
    .replace(/\r?\n/g, '\n')
}

/**
 * Format email message for chat display
 * @param text - The message text (could be MIME multipart)
 * @param preferFormat - 'original' to preserve HTML formatting, 'clean' for plain text
 */
export function formatEmailForChat(text: string, preferFormat: 'original' | 'clean' = 'clean'): string {
  if (!text) return ''

  // Check if it's a MIME multipart message
  if (isMimeMultipartMessage(text)) {
    const parsed = parseMimeMultipartMessage(text)
    
    if (preferFormat === 'original' && parsed.textHtml) {
      // Return HTML content for rich formatting (will be processed by ReactMarkdown)
      return cleanHtmlToMarkdown(parsed.textHtml)
    } else if (parsed.textPlain) {
      // Return the full plain text content without additional cleaning
      return parsed.textPlain
    } else if (parsed.textHtml) {
      // Fallback to simple HTML cleaning if no plain text
      return simpleHtmlClean(parsed.textHtml)
    }
  }

  // Not a MIME message, return as-is if it doesn't look like email headers
  if (isEmailLikeMessage(text) && !isMimeMultipartMessage(text)) {
    // Simple email header removal for non-MIME emails
    return removeEmailHeaders(text)
  }

  return text
}

/**
 * Convert HTML to basic Markdown for better chat display
 */
function cleanHtmlToMarkdown(html: string): string {
  let markdown = html
  
  // Remove doctype and html/head/body tags
  markdown = markdown.replace(/<!DOCTYPE[^>]*>/gi, '')
  markdown = markdown.replace(/<html[^>]*>/gi, '')
  markdown = markdown.replace(/<\/html>/gi, '')
  markdown = markdown.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
  markdown = markdown.replace(/<body[^>]*>/gi, '')
  markdown = markdown.replace(/<\/body>/gi, '')
  
  // Convert basic HTML to Markdown
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
  
  // Convert links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  
  // Convert line breaks
  markdown = markdown.replace(/<br[^>]*>/gi, '\n')
  markdown = markdown.replace(/<div[^>]*>/gi, '\n')
  markdown = markdown.replace(/<\/div>/gi, '')
  markdown = markdown.replace(/<p[^>]*>/gi, '\n')
  markdown = markdown.replace(/<\/p>/gi, '\n')
  
  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '')
  
  // Clean up extra whitespace
  markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n')
  markdown = markdown.trim()
  
  return markdown
}

/**
 * Detect if a message contains email-like content
 */
export function isEmailLikeMessage(text: string): boolean {
  if (!text) return false
  
  // Check for MIME multipart
  if (isMimeMultipartMessage(text)) return true
  
  // Check for common email patterns
  const emailPatterns = [
    /Content-Type:\s*text\//i,
    /Content-Transfer-Encoding:/i,
    /Subject:/i,
    /From:.*@.*\.(com|org|net|edu)/i,
    /To:.*@.*\.(com|org|net|edu)/i,
    /<html[^>]*>[\s\S]*<\/html>/i
  ]
  
  return emailPatterns.some(pattern => pattern.test(text))
}

/**
 * Extract email summary for quick preview
 */
export function getEmailSummary(text: string, maxLength: number = 150): string {
  const parsed = parseMimeMultipartMessage(text)
  const content = parsed.cleanText || text
  
  if (content.length <= maxLength) {
    return content
  }
  
  // Try to cut at sentence boundary
  const truncated = content.substring(0, maxLength)
  const lastSentence = truncated.lastIndexOf('.')
  const lastSpace = truncated.lastIndexOf(' ')
  
  if (lastSentence > maxLength * 0.7) {
    return truncated.substring(0, lastSentence + 1)
  } else if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...'
  } else {
    return truncated + '...'
  }
} 