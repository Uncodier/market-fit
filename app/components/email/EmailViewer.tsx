"use client"

import React, { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { parseMimeMultipartMessage } from "@/app/utils/email-formatter"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import * as Icons from "@/app/components/ui/icons"

interface EmailPart {
  type: 'text' | 'html' | 'attachment'
  content: string
  contentType?: string
  filename?: string
  contentId?: string
  encoding?: string
}

interface EmailViewerProps {
  emailContent: string
  className?: string
}

/**
 * Highlight contact information (phones, emails, URLs) in text
 */
function highlightContactInfo(text: string): string {
  let highlighted = text

  // Highlight phone numbers (more specific patterns to avoid breaking dates)
  // Pattern 1: International format with country code
  highlighted = highlighted.replace(
    /(\+\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9})/g,
    '<span class="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 2: US/Canada format (555) 123-4567 or 555-123-4567
  highlighted = highlighted.replace(
    /(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g,
    '<span class="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 3: Mexican format (city code + number) - more specific
  highlighted = highlighted.replace(
    /(\b\d{2,3}\s\d{3,4}\s\d{3,4}\b)/g,
    '<span class="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Highlight email addresses
  highlighted = highlighted.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<span class="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Highlight URLs (more specific patterns)
  highlighted = highlighted.replace(
    /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g,
    '<span class="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Highlight domain names (www.domain.com, domain.com) - avoid breaking dates
  highlighted = highlighted.replace(
    /(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<span class="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Highlight standalone domains (but not if they look like dates)
  highlighted = highlighted.replace(
    /\b([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?=\s|$|[^\w.-])(?!\s+\d{4})/g,
    '<span class="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Highlight dates (various formats)
  // Pattern 1: Sep 25, 2025 or September 25, 2025
  highlighted = highlighted.replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    '<span class="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 2: 25/09/2025 or 09/25/2025
  highlighted = highlighted.replace(
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    '<span class="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 3: 2025-09-25 (ISO format)
  highlighted = highlighted.replace(
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
    '<span class="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 4: 25 de septiembre de 2025 (Spanish format)
  highlighted = highlighted.replace(
    /\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}\b/gi,
    '<span class="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 5: Thu, Sep 25, 2025 at 3:23 PM (email header format)
  highlighted = highlighted.replace(
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+(AM|PM)\b/gi,
    '<span class="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Highlight times (various formats)
  // Pattern 1: 3:23 PM or 3:23 AM (complete time with AM/PM)
  highlighted = highlighted.replace(
    /(\d{1,2}:\d{2}\s+(AM|PM))/gi,
    '<span class="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 2: 06:02 p.m. or 06:02 a.m. (Spanish format - complete time)
  highlighted = highlighted.replace(
    /(\d{1,2}:\d{2}\s+(p\.m\.|a\.m\.))/gi,
    '<span class="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  // Pattern 3: 15:30 (24-hour format) - but avoid if it's part of a date
  highlighted = highlighted.replace(
    /\b(\d{1,2}:\d{2})\b(?!\s+(AM|PM|p\.m\.|a\.m\.))/g,
    '<span class="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-1 py-0.5 rounded text-xs font-medium">$1</span>'
  )

  return highlighted
}

export function EmailViewer({ emailContent, className }: EmailViewerProps) {
  const [showAttachments, setShowAttachments] = useState(false)

  console.log('🔍 [EmailViewer] Received emailContent length:', emailContent?.length)
  console.log('🔍 [EmailViewer] First 200 chars:', emailContent?.substring(0, 200))

  const parsedEmail = useMemo(() => {
    console.log('🔍 [EmailViewer] Parsing email content...')
    const result = parseMimeMultipartMessage(emailContent)
    console.log('🔍 [EmailViewer] Parsed result:', result)
    return result
  }, [emailContent])

  // Convert the parsed result to the format expected by the component
  const textPart = parsedEmail.textPlain ? {
    type: 'text' as const,
    content: parsedEmail.textPlain,
    contentType: 'text/plain'
  } : undefined

  const htmlPart = parsedEmail.textHtml ? {
    type: 'html' as const,
    content: parsedEmail.textHtml,
    contentType: 'text/html'
  } : undefined

  const attachments: EmailPart[] = [] // We'll handle attachments later if needed

  // Determine initial tab based on available content
  const defaultValue = htmlPart ? 'html' : textPart ? 'text' : 'raw'

  const formatTextContent = (content: string): string => {
    // Content is already decoded by parseMimeMultipartMessage
    let formatted = content
      .replace(/\n\n/g, '<br><br>') // Double line breaks become paragraph breaks
      .replace(/\n/g, '<br>') // Single line breaks become line breaks
      .replace(/>/g, '&gt;')
      .replace(/</g, '&lt;')

    // Apply comprehensive encoding fixes for Spanish characters
    formatted = formatted
      .replace(/dÃ©cada/g, 'década') // Fix década
      .replace(/emprendimientoes/g, 'emprendimiento es') // Fix emprendimientoes
      .replace(/seÃ±al/g, 'señal') // Fix señal
      .replace(/paÃs/g, 'país') // Fix país
      .replace(/capÃtulo/g, 'capítulo') // Fix capítulo
      .replace(/lÃderes/g, 'líderes') // Fix líderes
      .replace(/vÃa/g, 'vía') // Fix vía
      .replace(/aquà/g, 'aquí') // Fix aquí
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

    // Apply highlighting for phones, emails, and URLs
    formatted = highlightContactInfo(formatted)

    return formatted
  }

  const formatHtmlContent = (content: string): string => {
    console.log('🔍 [formatHtmlContent] Input content length:', content.length)
    console.log('🔍 [formatHtmlContent] First 200 chars:', content.substring(0, 200))
    
    // Content is already decoded by parseMimeMultipartMessage
    // Advanced cleanup for complex HTML content (Google Meet, etc.)
    let cleaned = content
    
    // Step 1: Remove all CSS styles and font declarations
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    cleaned = cleaned.replace(/@font-face\s*\{[^}]*\}/gi, '')
    cleaned = cleaned.replace(/@media\s*[^{]*\{[^}]*\}/gi, '')
    cleaned = cleaned.replace(/@viewport\s*\{[^}]*\}/gi, '')
    
    // Step 2: Remove CSS rules and selectors
    cleaned = cleaned.replace(/[^{}]*\{[^}]*\}/g, '')
    cleaned = cleaned.replace(/\.\w+[^{]*\{[^}]*\}/g, '')
    cleaned = cleaned.replace(/#\w+[^{]*\{[^}]*\}/g, '')
    
    // Step 3: Remove specific problematic patterns
    cleaned = cleaned.replace(/Mime-Version:\s*1\.0\s*\d*\s*/g, '') // Remove Mime-Version header
    cleaned = cleaned.replace(/\*\{[^}]*\}/g, '') // Remove CSS blocks starting with *
    cleaned = cleaned.replace(/body\{[^}]*\}/g, '') // Remove body styles
    cleaned = cleaned.replace(/a\{[^}]*\}/g, '') // Remove link styles
    cleaned = cleaned.replace(/#MessageViewBody[^}]*\}/g, '') // Remove MessageViewBody styles
    cleaned = cleaned.replace(/p\{[^}]*\}/g, '') // Remove paragraph styles
    cleaned = cleaned.replace(/\.desktop_hide[^}]*\}/g, '') // Remove desktop_hide styles
    cleaned = cleaned.replace(/\.image_block[^}]*\}/g, '') // Remove image_block styles
    cleaned = cleaned.replace(/\.row-content[^}]*\}/g, '') // Remove row-content styles
    cleaned = cleaned.replace(/\.stack[^}]*\}/g, '') // Remove stack styles
    cleaned = cleaned.replace(/\.column[^}]*\}/g, '') // Remove column styles
    cleaned = cleaned.replace(/\.mobile_hide[^}]*\}/g, '') // Remove mobile_hide styles
    cleaned = cleaned.replace(/sub,sup\{[^}]*\}/g, '') // Remove sub/sup styles
    cleaned = cleaned.replace(/@media[^}]*\}/g, '') // Remove media queries
    cleaned = cleaned.replace(/sup\s*\{[^}]*\}/g, '') // Remove sup styles
    cleaned = cleaned.replace(/sub\s*\{[^}]*\}/g, '') // Remove sub styles
    
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
    
    // Step 7: Remove remaining CSS brackets and artifacts
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
    
    // Step 8: Normalize whitespace
    cleaned = cleaned.replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
    cleaned = cleaned.trim()

    // Step 9: Apply comprehensive encoding fixes for Spanish characters
    cleaned = cleaned
      .replace(/dÃ©cada/g, 'década') // Fix década
      .replace(/emprendimientoes/g, 'emprendimiento es') // Fix emprendimientoes
      .replace(/seÃ±al/g, 'señal') // Fix señal
      .replace(/paÃs/g, 'país') // Fix país
      .replace(/capÃtulo/g, 'capítulo') // Fix capítulo
      .replace(/lÃderes/g, 'líderes') // Fix líderes
      .replace(/vÃa/g, 'vía') // Fix vía
      .replace(/aquà/g, 'aquí') // Fix aquí
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

    // Step 10: Apply highlighting for contact information
    cleaned = highlightContactInfo(cleaned)

    console.log('🔍 [formatHtmlContent] Output content length:', cleaned.length)
    console.log('🔍 [formatHtmlContent] Last 200 chars:', cleaned.substring(Math.max(0, cleaned.length - 200)))
    
    return cleaned
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Subtle header with email type and tabs */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
          {parsedEmail.hasMultipart ? 'Multipart Email' : 'Email'}
        </span>
        
        {attachments.length > 0 && (
          <button
            onClick={() => setShowAttachments(!showAttachments)}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Content Display - Always show tabs with HTML, Raw, and Text (if available) */}
      <Tabs defaultValue={defaultValue} className="w-full">
        <div className="flex justify-center">
          <TabsList className="inline-flex h-8 w-auto p-1">
            {htmlPart && (
              <TabsTrigger value="html" className="h-6 w-6 p-0">
                <Icons.Code className="h-3 w-3" />
              </TabsTrigger>
            )}
            {textPart && (
              <TabsTrigger value="text" className="h-6 w-6 p-0">
                <Icons.Type className="h-3 w-3" />
              </TabsTrigger>
            )}
            <TabsTrigger value="raw" className="h-6 w-6 p-0">
              <Icons.FileText className="h-3 w-3" />
            </TabsTrigger>
          </TabsList>
        </div>
        
        {htmlPart && (
          <TabsContent value="html" className="mt-3">
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ 
                __html: formatHtmlContent(htmlPart.content) 
              }}
            />
          </TabsContent>
        )}
        
        {textPart && (
          <TabsContent value="text" className="mt-3">
            <div 
              className="whitespace-pre-wrap text-sm text-foreground"
              dangerouslySetInnerHTML={{ 
                __html: formatTextContent(textPart.content) 
              }}
            />
          </TabsContent>
        )}

        <TabsContent value="raw" className="mt-3">
          <div className="bg-muted/20 border rounded-md p-3">
            <div className="text-xs text-muted-foreground mb-2">Raw Email Content</div>
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words overflow-x-auto">
              {emailContent}
            </pre>
          </div>
        </TabsContent>
      </Tabs>

      {/* Attachments */}
      {showAttachments && attachments.length > 0 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-md">
          <h4 className="text-sm font-medium text-foreground mb-2">Attachments</h4>
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-background/50 rounded border">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-muted rounded flex items-center justify-center">
                    <svg className="w-3 h-3 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {attachment.filename || `Attachment ${index + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {attachment.contentType || 'Unknown type'}
                    </p>
                  </div>
                </div>
                <button className="text-primary hover:text-primary/80 text-sm">
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


