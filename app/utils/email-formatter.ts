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
  
  // Check for MIME multipart boundaries (more flexible pattern)
  const hasMimeBoundary = /--[A-Za-z0-9_=-]{10,}/i.test(text)
  const hasContentType = /Content-Type:\s*(text\/plain|text\/html|multipart\/alternative)/i.test(text)
  const hasContentTransferEncoding = /Content-Transfer-Encoding:/i.test(text)
  
  // Also check for the specific pattern in the user's email
  const hasMultipartAlternative = /Content-Type:\s*multipart\/alternative/i.test(text)
  const hasQuotedPrintable = /Content-Transfer-Encoding:\s*quoted-printable/i.test(text)
  
  // Check for quoted-printable encoded content (like =C2=BF, =C3=B3, etc.)
  const hasQuotedPrintableContent = /=[A-F0-9]{2}=[A-F0-9]{2}/i.test(text)
  
  // Check for email headers pattern
  const hasEmailHeaders = /Content-Type:\s*text\/plain;\s*charset/i.test(text)
  
  // Must have boundary and either content-type or transfer-encoding
  return (hasMimeBoundary && hasContentType && hasContentTransferEncoding) ||
         (hasMimeBoundary && hasMultipartAlternative && hasQuotedPrintable) ||
         (hasEmailHeaders && hasQuotedPrintableContent) ||
         (hasMimeBoundary && hasQuotedPrintableContent)
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
  const plainTextMatch = text.match(/Content-Type:\s*text\/plain[\s\S]*?charset=utf-8\s+([\s\S]+?)(?=\s+--[A-Za-z0-9_=-]{10,})/i)
  if (plainTextMatch) {
    textPlain = decodeQuotedPrintable(plainTextMatch[1].trim())
    console.log('📧 Plain text extracted (production format):', textPlain.substring(0, 100) + '...')
  }

  // Try alternative pattern for quoted-printable content
  if (!textPlain) {
    const plainTextMatch2 = text.match(/Content-Type:\s*text\/plain[\s\S]*?Content-Transfer-Encoding:\s*quoted-printable\s+([\s\S]+?)(?=\s+--[A-Za-z0-9_=-]{10,})/i)
    if (plainTextMatch2) {
      textPlain = decodeQuotedPrintable(plainTextMatch2[1].trim())
      console.log('📧 Plain text extracted (quoted-printable format):', textPlain.substring(0, 100) + '...')
    }
  }

  // Try a more aggressive pattern for plain text
  if (!textPlain) {
    const plainTextMatch3 = text.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]+?)(?=\s+--[A-Za-z0-9_=-]{10,})/i)
    if (plainTextMatch3) {
      textPlain = decodeQuotedPrintable(plainTextMatch3[1].trim())
      console.log('📧 Plain text extracted (aggressive pattern):', textPlain.substring(0, 100) + '...')
    }
  }

  // Try to extract HTML content - use more flexible patterns
  const htmlMatch = text.match(/Content-Type:\s*text\/html[\s\S]*?charset=utf-8\s+([\s\S]+?)(?=\s+--[A-Za-z0-9_=-]{10,}|$)/i)
  if (htmlMatch) {
    textHtml = decodeQuotedPrintable(htmlMatch[1].trim())
    console.log('📧 HTML content extracted:', textHtml.substring(0, 100) + '...')
  }

  // Try alternative pattern for HTML with quoted-printable
  if (!textHtml) {
    const htmlMatch2 = text.match(/Content-Type:\s*text\/html[\s\S]*?Content-Transfer-Encoding:\s*quoted-printable\s+([\s\S]+?)(?=\s+--[A-Za-z0-9_=-]{10,}|$)/i)
    if (htmlMatch2) {
      textHtml = decodeQuotedPrintable(htmlMatch2[1].trim())
      console.log('📧 HTML content extracted (quoted-printable format):', textHtml.substring(0, 100) + '...')
    }
  }

  // Try a more aggressive pattern that looks for HTML content after Content-Type: text/html
  if (!textHtml) {
    const htmlMatch3 = text.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]+?)(?=\s+--[A-Za-z0-9_=-]{10,}|$)/i)
    if (htmlMatch3) {
      textHtml = decodeQuotedPrintable(htmlMatch3[1].trim())
      console.log('📧 HTML content extracted (aggressive pattern):', textHtml.substring(0, 100) + '...')
    }
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

  // Final fallback: try to extract content without strict boundary matching
  if (!textPlain && !textHtml) {
    console.log('📧 Trying fallback extraction methods...')
    
    // Try to find HTML content anywhere in the text
    const fallbackHtmlMatch = text.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]+)/i)
    if (fallbackHtmlMatch) {
      textHtml = decodeQuotedPrintable(fallbackHtmlMatch[1].trim())
      console.log('📧 HTML content extracted (fallback):', textHtml.substring(0, 100) + '...')
    }
    
    // Try to find plain text content anywhere in the text
    const fallbackPlainMatch = text.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]+)/i)
    if (fallbackPlainMatch) {
      textPlain = decodeQuotedPrintable(fallbackPlainMatch[1].trim())
      console.log('📧 Plain text extracted (fallback):', textPlain.substring(0, 100) + '...')
    }
  }

  // Special handling for emails with quoted-printable content but no clear boundaries
  if (!textPlain && !textHtml && /=[A-F0-9]{2}=[A-F0-9]{2}/i.test(text)) {
    console.log('📧 Detected quoted-printable content, trying direct decoding...')
    
    // Try to extract content after Content-Type headers
    const quotedPrintableMatch = text.match(/Content-Type:\s*text\/plain;\s*charset[^]*?Content-Transfer-Encoding:\s*quoted-printable\s+([\s\S]+)/i)
    if (quotedPrintableMatch) {
      textPlain = decodeQuotedPrintable(quotedPrintableMatch[1].trim())
      console.log('📧 Plain text extracted (quoted-printable fallback):', textPlain.substring(0, 100) + '...')
    }
    
    // If still no content, try to decode the entire text if it looks like quoted-printable
    if (!textPlain && !textHtml && text.includes('=') && /=[A-F0-9]{2}/i.test(text)) {
      console.log('📧 Attempting to decode entire text as quoted-printable...')
      const decoded = decodeQuotedPrintable(text)
      if (decoded !== text && decoded.length > 50) { // Only if decoding actually changed something
        textPlain = decoded
        console.log('📧 Entire text decoded as quoted-printable:', textPlain.substring(0, 100) + '...')
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
    cleanLength: cleanText.length,
    plainLength: textPlain?.length || 0,
    htmlLength: textHtml?.length || 0
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
 * Advanced HTML cleaning for complex email content (Google Meet, etc.)
 */
function simpleHtmlClean(html: string): string {
  console.log('🧽 [simpleHtmlClean] Input length:', html.length)
  
  let cleaned = html
  
  // Step 1: Remove all CSS styles and font-face declarations
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  cleaned = cleaned.replace(/@font-face\s*\{[^}]*\}/gi, '')
  cleaned = cleaned.replace(/@media\s*[^{]*\{[^}]*\}/gi, '')
  cleaned = cleaned.replace(/@viewport\s*\{[^}]*\}/gi, '')
  
  // Step 2: Remove CSS rules and selectors
  cleaned = cleaned.replace(/[^{}]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.\w+[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/#\w+[^{]*\{[^}]*\}/g, '')
  
  // Step 2.5: Remove remaining standalone closing brackets
  cleaned = cleaned.replace(/\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*/g, ' ')
  
  // Step 3: Remove specific problematic CSS patterns
  cleaned = cleaned.replace(/body, html[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.body-container[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.appointment-buttons[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.main-container[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.info-bar[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.primary-text[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.secondary-text[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.accent-text[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.primary-button[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.underline-on-hover[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.grey-infobar-text[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.prevent-link[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.encryption-icon[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.cse-banner[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.google-material-icons[^{]*\{[^}]*\}/g, '')
  cleaned = cleaned.replace(/\.google-material-icons-filled[^{]*\{[^}]*\}/g, '')
  
  // Step 4: Remove font URLs and external references
  cleaned = cleaned.replace(/url\([^)]*\)/g, '')
  cleaned = cleaned.replace(/src:\s*url\([^)]*\)/g, '')
  cleaned = cleaned.replace(/fonts\.gstatic\.com[^}]*/g, '')
  
  // Step 5: Remove HTML tags but preserve content
  cleaned = cleaned.replace(/<[^>]*>/g, '')
  
  // Step 6: Decode HTML entities
  cleaned = cleaned.replace(/&amp;/g, '&')
  cleaned = cleaned.replace(/&lt;/g, '<')
  cleaned = cleaned.replace(/&gt;/g, '>')
  cleaned = cleaned.replace(/&quot;/g, '"')
  cleaned = cleaned.replace(/&apos;/g, "'")
  cleaned = cleaned.replace(/&nbsp;/g, ' ')
  cleaned = cleaned.replace(/&#\d+;/g, '')
  
  // Step 7: Remove specific Google Meet/Calendar artifacts
  cleaned = cleaned.replace(/Derly - Rahiza/g, 'Derly - Rahiza')
  cleaned = cleaned.replace(/Join with Google Meet/g, 'Join with Google Meet')
  cleaned = cleaned.replace(/You have been invited by/g, 'You have been invited by')
  cleaned = cleaned.replace(/to attend an event named/g, 'to attend an event named')
  cleaned = cleaned.replace(/This event has been updated/g, 'This event has been updated')
  cleaned = cleaned.replace(/Changed: time/g, 'Changed: time')
  cleaned = cleaned.replace(/Meeting link/g, 'Meeting link')
  cleaned = cleaned.replace(/Join by phone/g, 'Join by phone')
  cleaned = cleaned.replace(/More phone numbers/g, 'More phone numbers')
  cleaned = cleaned.replace(/When CHANGED/g, 'When CHANGED')
  cleaned = cleaned.replace(/Old:/g, 'Old:')
  cleaned = cleaned.replace(/Guests/g, 'Guests')
  cleaned = cleaned.replace(/- organizer/g, '- organizer')
  
  // Step 8: Apply comprehensive encoding fixes
  cleaned = applyComprehensiveEncodingFixes(cleaned)
  
  // Step 9: Normalize whitespace but preserve line breaks
  cleaned = cleaned.replace(/\r\n/g, '\n')
  cleaned = cleaned.replace(/\r/g, '\n')
  cleaned = cleaned.replace(/[ \t]+/g, ' ')
  cleaned = cleaned.replace(/\n[ \t]+/g, '\n')
  cleaned = cleaned.replace(/[ \t]+\n/g, '\n')
  
  // Step 10: Final cleanup - remove any remaining CSS artifacts
  cleaned = cleaned.replace(/\s*\}\s*\}\s*\}\s*\}\s*\}\s*\}\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*\{\s*\{\s*\{\s*\{\s*\{\s*\{\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\}\s*\}\s*\}\s*\}\s*\}\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*\{\s*\{\s*\{\s*\{\s*\{\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\}\s*\}\s*\}\s*\}\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*\{\s*\{\s*\{\s*\{\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\}\s*\}\s*\}\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*\{\s*\{\s*\{\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\}\s*\}\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*\{\s*\{\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\}\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*\{\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\}\s*/g, ' ')
  cleaned = cleaned.replace(/\s*\{\s*/g, ' ')
  
  // Step 11: Remove excessive whitespace and clean up
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')
  cleaned = cleaned.replace(/^\s+|\s+$/g, '')
  
  console.log('🧽 [simpleHtmlClean] Output length:', cleaned.length)
  console.log('🧽 [simpleHtmlClean] First 200 chars:', cleaned.substring(0, 200))
  
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
 * Apply comprehensive encoding fixes for Spanish and other characters
 */
function applyComprehensiveEncodingFixes(text: string): string {
  return text
    // Remove all non-printable and control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Fix common UTF-8 encoding issues
    .replace(/Â/g, '') // Remove non-breaking space artifacts
    .replace(/â¯/g, ' ') // Replace narrow no-break space
    .replace(/â/g, '') // Remove other narrow space artifacts
    .replace(/¯/g, '') // Remove macron characters
    .replace(/­/g, '') // Remove soft hyphens
    .replace(/­/g, '') // Remove other soft hyphens
    .replace(/­/g, '') // Remove zero-width characters
    .replace(/­/g, '') // Remove other zero-width characters
    // Fix specific Spanish character encoding issues
    .replace(/dÃa/g, 'día') // Fix día
    .replace(/agradecerÃa/g, 'agradecería') // Fix agradecería
    .replace(/informaciÃ³n/g, 'información') // Fix información
    .replace(/privacidad/g, 'privacidad') // Ensure privacidad is correct
    .replace(/polÃtico/g, 'político') // Fix político
    .replace(/dÃ©cada/g, 'década') // Fix década
    .replace(/ademas/g, 'además') // Fix además
    .replace(/ademÃ¡s/g, 'además') // Fix además (encoded)
    .replace(/dÃ©cada/g, 'década') // Fix década (specific case)
    .replace(/emprendimientoes/g, 'emprendimiento es') // Fix emprendimientoes
    .replace(/seÃ±al/g, 'señal') // Fix señal
    .replace(/paÃs/g, 'país') // Fix país
    .replace(/capÃtulo/g, 'capítulo') // Fix capítulo
    .replace(/lÃderes/g, 'líderes') // Fix líderes
    .replace(/vÃa/g, 'vía') // Fix vía
    .replace(/aquà/g, 'aquí') // Fix aquí
    // Fix Spanish characters - more comprehensive
    .replace(/Ã¡/g, 'á') // Fix á
    .replace(/Ã©/g, 'é') // Fix é
    .replace(/Ã­/g, 'í') // Fix í
    .replace(/Ã³/g, 'ó') // Fix ó
    .replace(/Ãº/g, 'ú') // Fix ú
    .replace(/Ã±/g, 'ñ') // Fix ñ
    .replace(/Ã'/g, 'Ñ') // Fix Ñ
    .replace(/Ã¼/g, 'ü') // Fix ü
    .replace(/Ã§/g, 'ç') // Fix ç
    .replace(/Ã /g, 'à') // Fix à
    .replace(/Ã¨/g, 'è') // Fix è
    .replace(/Ã¬/g, 'ì') // Fix ì
    .replace(/Ã²/g, 'ò') // Fix ò
    .replace(/Ã¹/g, 'ù') // Fix ù
    // Fix additional Spanish encoding issues
    .replace(/Ãa/g, 'ía') // Fix ía
    .replace(/Ã³n/g, 'ón') // Fix ón
    .replace(/Ã­a/g, 'ía') // Fix ía
    .replace(/Ã©a/g, 'éa') // Fix éa
    .replace(/Ãºa/g, 'úa') // Fix úa
    // Fix comprehensive Spanish character combinations
    .replace(/Ã¡n/g, 'án') // Fix án
    .replace(/Ã©n/g, 'én') // Fix én
    .replace(/Ã­n/g, 'ín') // Fix ín
    .replace(/Ã³n/g, 'ón') // Fix ón
    .replace(/Ãºn/g, 'ún') // Fix ún
    .replace(/Ã¡s/g, 'ás') // Fix ás
    .replace(/Ã©s/g, 'és') // Fix és
    .replace(/Ã­s/g, 'ís') // Fix ís
    .replace(/Ã³s/g, 'ós') // Fix ós
    .replace(/Ãºs/g, 'ús') // Fix ús
    .replace(/Ã¡r/g, 'ár') // Fix ár
    .replace(/Ã©r/g, 'ér') // Fix ér
    .replace(/Ã­r/g, 'ír') // Fix ír
    .replace(/Ã³r/g, 'ór') // Fix ór
    .replace(/Ãºr/g, 'úr') // Fix úr
    .replace(/Ã¡l/g, 'ál') // Fix ál
    .replace(/Ã©l/g, 'él') // Fix él
    .replace(/Ã­l/g, 'íl') // Fix íl
    .replace(/Ã³l/g, 'ól') // Fix ól
    .replace(/Ãºl/g, 'úl') // Fix úl
    .replace(/Ã¡m/g, 'ám') // Fix ám
    .replace(/Ã©m/g, 'ém') // Fix ém
    .replace(/Ã­m/g, 'ím') // Fix ím
    .replace(/Ã³m/g, 'óm') // Fix óm
    .replace(/Ãºm/g, 'úm') // Fix úm
    .replace(/Ã¡d/g, 'ád') // Fix ád
    .replace(/Ã©d/g, 'éd') // Fix éd
    .replace(/Ã­d/g, 'íd') // Fix íd
    .replace(/Ã³d/g, 'ód') // Fix ód
    .replace(/Ãºd/g, 'úd') // Fix úd
    .replace(/Ã¡c/g, 'ác') // Fix ác
    .replace(/Ã©c/g, 'éc') // Fix éc
    .replace(/Ã­c/g, 'íc') // Fix íc
    .replace(/Ã³c/g, 'óc') // Fix óc
    .replace(/Ãºc/g, 'úc') // Fix úc
    .replace(/Ã¡t/g, 'át') // Fix át
    .replace(/Ã©t/g, 'ét') // Fix ét
    .replace(/Ã­t/g, 'ít') // Fix ít
    .replace(/Ã³t/g, 'ót') // Fix ót
    .replace(/Ãºt/g, 'út') // Fix út
    .replace(/Ã¡p/g, 'áp') // Fix áp
    .replace(/Ã©p/g, 'ép') // Fix ép
    .replace(/Ã­p/g, 'íp') // Fix íp
    .replace(/Ã³p/g, 'óp') // Fix óp
    .replace(/Ãºp/g, 'úp') // Fix úp
    .replace(/Ã¡b/g, 'áb') // Fix áb
    .replace(/Ã©b/g, 'éb') // Fix éb
    .replace(/Ã­b/g, 'íb') // Fix íb
    .replace(/Ã³b/g, 'ób') // Fix ób
    .replace(/Ãºb/g, 'úb') // Fix úb
    .replace(/Ã¡v/g, 'áv') // Fix áv
    .replace(/Ã©v/g, 'év') // Fix év
    .replace(/Ã­v/g, 'ív') // Fix ív
    .replace(/Ã³v/g, 'óv') // Fix óv
    .replace(/Ãºv/g, 'úv') // Fix úv
    .replace(/Ã¡z/g, 'áz') // Fix áz
    .replace(/Ã©z/g, 'éz') // Fix éz
    .replace(/Ã­z/g, 'íz') // Fix íz
    .replace(/Ã³z/g, 'óz') // Fix óz
    .replace(/Ãºz/g, 'úz') // Fix úz
    .replace(/Ã¡j/g, 'áj') // Fix áj
    .replace(/Ã©j/g, 'éj') // Fix éj
    .replace(/Ã­j/g, 'íj') // Fix íj
    .replace(/Ã³j/g, 'ój') // Fix ój
    .replace(/Ãºj/g, 'új') // Fix új
    .replace(/Ã¡k/g, 'ák') // Fix ák
    .replace(/Ã©k/g, 'ék') // Fix ék
    .replace(/Ã­k/g, 'ík') // Fix ík
    .replace(/Ã³k/g, 'ók') // Fix ók
    .replace(/Ãºk/g, 'úk') // Fix úk
    .replace(/Ã¡w/g, 'áw') // Fix áw
    .replace(/Ã©w/g, 'éw') // Fix éw
    .replace(/Ã­w/g, 'íw') // Fix íw
    .replace(/Ã³w/g, 'ów') // Fix ów
    .replace(/Ãºw/g, 'úw') // Fix úw
    .replace(/Ã¡x/g, 'áx') // Fix áx
    .replace(/Ã©x/g, 'éx') // Fix éx
    .replace(/Ã­x/g, 'íx') // Fix íx
    .replace(/Ã³x/g, 'óx') // Fix óx
    .replace(/Ãºx/g, 'úx') // Fix úx
    .replace(/Ã¡y/g, 'áy') // Fix áy
    .replace(/Ã©y/g, 'éy') // Fix éy
    .replace(/Ã­y/g, 'íy') // Fix íy
    .replace(/Ã³y/g, 'óy') // Fix óy
    .replace(/Ãºy/g, 'úy') // Fix úy
    .replace(/Ã¡q/g, 'áq') // Fix áq
    .replace(/Ã©q/g, 'éq') // Fix éq
    .replace(/Ã­q/g, 'íq') // Fix íq
    .replace(/Ã³q/g, 'óq') // Fix óq
    .replace(/Ãºq/g, 'úq') // Fix úq
    .replace(/Ã¡f/g, 'áf') // Fix áf
    .replace(/Ã©f/g, 'éf') // Fix éf
    .replace(/Ã­f/g, 'íf') // Fix íf
    .replace(/Ã³f/g, 'óf') // Fix óf
    .replace(/Ãºf/g, 'úf') // Fix úf
    .replace(/Ã¡g/g, 'ág') // Fix ág
    .replace(/Ã©g/g, 'ég') // Fix ég
    .replace(/Ã­g/g, 'íg') // Fix íg
    .replace(/Ã³g/g, 'óg') // Fix óg
    .replace(/Ãºg/g, 'úg') // Fix úg
    .replace(/Ã¡h/g, 'áh') // Fix áh
    .replace(/Ã©h/g, 'éh') // Fix éh
    .replace(/Ã­h/g, 'íh') // Fix íh
    .replace(/Ã³h/g, 'óh') // Fix óh
    .replace(/Ãºh/g, 'úh') // Fix úh
    .replace(/Ã¡i/g, 'ái') // Fix ái
    .replace(/Ã©i/g, 'éi') // Fix éi
    .replace(/Ã­i/g, 'íi') // Fix íi
    .replace(/Ã³i/g, 'ói') // Fix ói
    .replace(/Ãºi/g, 'úi') // Fix úi
    .replace(/Ã¡o/g, 'áo') // Fix áo
    .replace(/Ã©o/g, 'éo') // Fix éo
    .replace(/Ã­o/g, 'ío') // Fix ío
    .replace(/Ã³o/g, 'óo') // Fix óo
    .replace(/Ãºo/g, 'úo') // Fix úo
    .replace(/Ã¡u/g, 'áu') // Fix áu
    .replace(/Ã©u/g, 'éu') // Fix éu
    .replace(/Ã­u/g, 'íu') // Fix íu
    .replace(/Ã³u/g, 'óu') // Fix óu
    .replace(/Ãºu/g, 'úu') // Fix úu
    // Fix other common encoding issues
    .replace(/Ã¢/g, 'â') // Fix â
    .replace(/Ã£/g, 'ã') // Fix ã
    .replace(/Ã¤/g, 'ä') // Fix ä
    .replace(/Ã¥/g, 'å') // Fix å
    .replace(/Ã¦/g, 'æ') // Fix æ
    .replace(/Ã§/g, 'ç') // Fix ç
    .replace(/Ã¨/g, 'è') // Fix è
    .replace(/Ã©/g, 'é') // Fix é
    .replace(/Ãª/g, 'ê') // Fix ê
    .replace(/Ã«/g, 'ë') // Fix ë
    .replace(/Ã¬/g, 'ì') // Fix ì
    .replace(/Ã­/g, 'í') // Fix í
    .replace(/Ã®/g, 'î') // Fix î
    .replace(/Ã¯/g, 'ï') // Fix ï
    .replace(/Ã°/g, 'ð') // Fix ð
    .replace(/Ã±/g, 'ñ') // Fix ñ
    .replace(/Ã²/g, 'ò') // Fix ò
    .replace(/Ã³/g, 'ó') // Fix ó
    .replace(/Ã´/g, 'ô') // Fix ô
    .replace(/Ãµ/g, 'õ') // Fix õ
    .replace(/Ã¶/g, 'ö') // Fix ö
    .replace(/Ã·/g, '÷') // Fix ÷
    .replace(/Ã¸/g, 'ø') // Fix ø
    .replace(/Ã¹/g, 'ù') // Fix ù
    .replace(/Ãº/g, 'ú') // Fix ú
    .replace(/Ã»/g, 'û') // Fix û
    .replace(/Ã¼/g, 'ü') // Fix ü
    .replace(/Ã½/g, 'ý') // Fix ý
    .replace(/Ã¾/g, 'þ') // Fix þ
    .replace(/Ã¿/g, 'ÿ') // Fix ÿ
    // Clean up extra spaces and formatting but preserve line breaks
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .replace(/=\s*/g, '') // Remove = and following spaces
    .replace(/\s*=\s*/g, '') // Remove spaces around =
    .replace(/\n\s*\n/g, '\n\n') // Preserve double line breaks
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
    .replace(/([a-z])([0-9])/g, '$1 $2') // Add space between letters and numbers
    .replace(/([0-9])([a-z])/g, '$1 $2') // Add space between numbers and letters
    .trim()
}

/**
 * Decode quoted-printable encoding with comprehensive character fixes
 */
function decodeQuotedPrintable(text: string): string {
  let decoded = text
    // Replace soft line breaks (=\n) first
    .replace(/=\r?\n/g, '')
    // Replace =XX hex sequences with actual characters
    .replace(/=([0-9A-F]{2})/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16))
    })
    // Replace hard line breaks
    .replace(/\r?\n/g, '\n')
  
  // Special handling for UTF-8 encoded characters
  // Fix common UTF-8 sequences that appear in quoted-printable
  decoded = decoded
    .replace(/¿/g, '¿') // Fix ¿ character
    .replace(/ó/g, 'ó') // Fix ó character
    .replace(/á/g, 'á') // Fix á character
    .replace(/é/g, 'é') // Fix é character
    .replace(/í/g, 'í') // Fix í character
    .replace(/ú/g, 'ú') // Fix ú character
    .replace(/ñ/g, 'ñ') // Fix ñ character
    .replace(/ü/g, 'ü') // Fix ü character
    .replace(/¡/g, '¡') // Fix ¡ character
    .replace(/ç/g, 'ç') // Fix ç character
    .replace(/à/g, 'à') // Fix à character
    .replace(/è/g, 'è') // Fix è character
    .replace(/ì/g, 'ì') // Fix ì character
    .replace(/ò/g, 'ò') // Fix ò character
    .replace(/ù/g, 'ù') // Fix ù character
  
  // Apply comprehensive encoding fixes
  decoded = applyComprehensiveEncodingFixes(decoded)
  
  return decoded
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