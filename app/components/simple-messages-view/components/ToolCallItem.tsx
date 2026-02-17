import React, { useState } from 'react'
import { Eye, EyeOff, Code, LayoutGrid, Zap, Search, Copy, Check, Download } from "@/app/components/ui/icons"
import { InstanceLog } from '../types'
import { getToolName, getToolResult, formatBase64Image } from '../utils'
import { renderObjectWithImages } from '../render-helpers'
import { GeneratedImageDisplay, GeneratedImageDisplayCollapsed } from './GeneratedImageDisplay'
import { GeneratedVideoDisplay, GeneratedVideoDisplayCollapsed } from './GeneratedVideoDisplay'
import { ImageFullscreenViewer } from './ImageFullscreenViewer'
import { VideoFullscreenViewer } from './VideoFullscreenViewer'
import { useToast } from '@/app/components/ui/use-toast'

interface ToolCallItemProps {
  log: InstanceLog
  isDarkMode: boolean
  collapsedToolDetails: Set<string>
  onToggleToolDetails: (logId: string) => void
  isBrowserVisible?: boolean
}

// Helper function to render tool icon
const renderToolIcon = (toolName: string) => {
  const lower = toolName.toLowerCase()
  if (lower === 'computer') return <Code className="h-3.5 w-3.5" />
  if (lower === 'structured_output') return <LayoutGrid className="h-3.5 w-3.5" />
  if (lower.includes('search') || lower === 'websearch') return <Search className="h-3.5 w-3.5" />
  return <Zap className="h-3.5 w-3.5" />
}

export const ToolCallItem: React.FC<ToolCallItemProps> = ({
  log,
  isDarkMode,
  collapsedToolDetails,
  onToggleToolDetails,
  isBrowserVisible = false
}) => {
  const toolName = getToolName(log)
  const toolResult = getToolResult(log)
  const [copied, setCopied] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const { toast } = useToast()

  // Function to copy tool content to clipboard
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the toggle details
    
    const contentToCopy = {
      toolName: toolName || 'Unknown',
      message: log.message || '',
      result: toolResult ? JSON.stringify(toolResult, null, 2) : '',
      details: log.details ? JSON.stringify(log.details, null, 2) : ''
    }
    
    const textToCopy = `Tool: ${contentToCopy.toolName}
Message: ${contentToCopy.message}
Result: ${contentToCopy.result}
Details: ${contentToCopy.details}`
    
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000) // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  // Function to download image
  const handleDownloadImage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!toolResult?.output?.images || toolResult.output.images.length === 0) {
      return
    }

    const images = toolResult.output.images
    const downloadImage = async (imageObj: any, index: number) => {
      try {
        const imageUrl = typeof imageObj === 'string' ? imageObj : imageObj?.url || ''
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `image-${index + 1}.${blob.type.split('/')[1] || 'png'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to download image:', err)
        toast({
          title: "Download failed",
          description: `Could not download image ${index + 1}`,
          variant: "destructive"
        })
      }
    }

    // Download all images
    for (let i = 0; i < images.length; i++) {
      await downloadImage(images[i], i)
      // Small delay between downloads
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    toast({
      title: "Download started",
      description: `Downloading ${images.length} image(s)...`,
    })
  }

  // Function to download video
  const handleDownloadVideo = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!toolResult?.output?.videos || toolResult.output.videos.length === 0) {
      return
    }

    const videos = toolResult.output.videos
    const downloadVideo = async (videoObj: any, index: number) => {
      try {
        const videoUrl = typeof videoObj === 'string' ? videoObj : videoObj?.url || ''
        const response = await fetch(videoUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `video-${index + 1}.${blob.type.split('/')[1] || 'mp4'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to download video:', err)
        toast({
          title: "Download failed",
          description: `Could not download video ${index + 1}`,
          variant: "destructive"
        })
      }
    }

    // Download all videos
    for (let i = 0; i < videos.length; i++) {
      await downloadVideo(videos[i], i)
      // Small delay between downloads
      if (i < videos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    toast({
      title: "Download started",
      description: `Downloading ${videos.length} video(s)...`,
    })
  }

  // Helper to check if tool result has an error
  const hasError = toolResult && (toolResult.error || toolResult.success === false)
  const errorMessage = toolResult?.error || toolResult?.output

  // Extract status from details object
  const status = log.details?.status

  const isImageGeneration = toolName === 'generate_image' && toolResult?.output?.images
  const isVideoGeneration = toolName === 'generate_video' && toolResult?.output?.videos
  const isMediaGeneration = isImageGeneration || isVideoGeneration
  
  return (
    <div className={`${isMediaGeneration ? 'inline-block' : 'w-full'} min-w-0 overflow-hidden`} style={isMediaGeneration ? { marginLeft: isBrowserVisible ? '0.75rem' : '2rem' } : undefined}>
      <div 
        className="rounded-lg p-3 text-xs cursor-pointer hover:opacity-80 transition-all duration-200 ease-in-out"
        style={{ 
          backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
          borderLeft: '3px solid var(--primary)',
          borderTop: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          boxShadow: 'none', 
          outline: 'none',
          filter: 'none'
        }}
        onClick={() => {
          // Only toggle if there are collapsible elements
          const hasCollapsibleElements = log.screenshot_base64 || 
            (toolResult && Object.keys(toolResult).length > 0 && toolName !== 'generate_image' && toolName !== 'generate_video') || 
            (log.details && Object.keys(log.details).length > 0)
          
          if (hasCollapsibleElements) {
            onToggleToolDetails(log.id)
          }
        }}
        title={
          (log.screenshot_base64 || (toolResult && Object.keys(toolResult).length > 0 && toolName !== 'generate_image' && toolName !== 'generate_video') || (log.details && Object.keys(log.details).length > 0))
            ? (collapsedToolDetails.has(log.id) ? "Click to show details" : "Click to hide details")
            : "Tool call completed"
        }
      >
        <div className="flex items-center gap-2">
          {toolName && renderToolIcon(toolName)}
          <span className="font-medium text-muted-foreground">
            {log.log_type === 'tool_call' ? 'Tool Call' : 'Tool Result'}: {toolName || 'Unknown'}
          </span>
          
          {/* Status badge - only show for pending status */}
          {status === 'pending' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-yellow-100/90 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
              <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
              Pending
            </span>
          )}
          
          {log.message && toolName !== 'generate_image' && toolName !== 'generate_video' && (
            <span className="text-muted-foreground/70 ml-2">
              - {log.message}
            </span>
          )}
          {hasError && (
            <span className="text-red-600 ml-2">
              - {toolName === 'generate_image' || toolName === 'generate_video' ? 'Generation failed' : 'Tool failed'}
            </span>
          )}
          {toolName === 'generate_image' && toolResult?.output?.images && (
            <span className="text-muted-foreground/70 ml-2">
              - Generated {toolResult.output.images.length} image(s)
            </span>
          )}
          {toolName === 'generate_video' && toolResult?.output?.videos && (
            <span className="text-muted-foreground/70 ml-2">
              - Generated {toolResult.output.videos.length} video(s)
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Download image button - only show for generate_image tool */}
            {toolName === 'generate_image' && toolResult?.output?.images && (
              <button
                onClick={handleDownloadImage}
                className="p-1 rounded hover:bg-muted-foreground/10 transition-colors"
                title="Download images"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
              </button>
            )}
            {/* Download video button - only show for generate_video tool */}
            {toolName === 'generate_video' && toolResult?.output?.videos && (
              <button
                onClick={handleDownloadVideo}
                className="p-1 rounded hover:bg-muted-foreground/10 transition-colors"
                title="Download videos"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
              </button>
            )}
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-muted-foreground/10 transition-colors"
              title={copied ? "Copied!" : "Copy tool content"}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
              )}
            </button>
            
            {/* Visibility toggle - only show if there are collapsible elements */}
            {(log.screenshot_base64 || (toolResult && Object.keys(toolResult).length > 0 && toolName !== 'generate_image' && toolName !== 'generate_video') || (log.details && Object.keys(log.details).length > 0)) && (
              collapsedToolDetails.has(log.id) ? (
                <Eye className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
              )
            )}
          </div>
        </div>

        {/* Generated images - always show for generate_image tool (collapsed view) */}
        {toolName === 'generate_image' && toolResult?.output?.images && (
          <div className="mt-3 inline-block">
            <GeneratedImageDisplayCollapsed 
              toolResult={toolResult} 
              isDarkMode={isDarkMode}
              onImageClick={() => setIsFullscreenOpen(true)}
              isBrowserVisible={isBrowserVisible}
            />
          </div>
        )}

        {/* Generated videos - always show for generate_video tool (collapsed view) */}
        {toolName === 'generate_video' && toolResult?.output?.videos && (
          <div className="mt-3 inline-block">
            <GeneratedVideoDisplayCollapsed 
              toolResult={toolResult} 
              isDarkMode={isDarkMode}
              onVideoClick={(e) => {
                e?.preventDefault()
                e?.stopPropagation()
                setIsFullscreenOpen(true)
              }}
              isBrowserVisible={isBrowserVisible}
            />
          </div>
        )}

        {/* Tool details - only show when NOT collapsed (default to collapsed) */}
        {!collapsedToolDetails.has(log.id) && (
          <>
            {/* Full details for generate_image when expanded */}
            {toolName === 'generate_image' && (toolResult?.output?.images || hasError) && (
              <div className="mt-2 text-muted-foreground">
                <div className="space-y-3">
                  {/* Original prompt */}
                  {log.message && (
                    <div>
                      <strong>Prompt:</strong>
                      <div className="mt-1 p-2 bg-muted/30 rounded text-sm">
                        {log.message}
                      </div>
                    </div>
                  )}
                  
                  {/* Generation details */}
                  {toolResult.output.metadata && (
                    <div>
                      <strong>Generation Details:</strong>
                      <div className="mt-1 text-xs bg-muted/30 rounded p-2">
                        <div className="grid grid-cols-2 gap-2">
                          {toolResult.output.metadata.size && (
                            <div>
                              <span className="font-medium">Size:</span> {toolResult.output.metadata.size}
                            </div>
                          )}
                          {toolResult.output.metadata.quality && (
                            <div>
                              <span className="font-medium">Quality:</span> {toolResult.output.metadata.quality}
                            </div>
                          )}
                          {toolResult.output.metadata.generated_at && (
                            <div>
                              <span className="font-medium">Generated:</span> {new Date(toolResult.output.metadata.generated_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Success message */}
                  {toolResult.output.message && (
                    <div>
                      <strong>Status:</strong>
                      <div className="mt-1 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded p-2">
                        {toolResult.output.message}
                      </div>
                    </div>
                  )}
                  
                      {/* Error display for failed image generation */}
                  {hasError && !toolResult?.output?.images && (
                    <div>
                      <strong className="text-red-600">Error:</strong>
                      <div className="mt-1 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-3 border border-red-200 dark:border-red-800">
                        {errorMessage}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Full details for generate_video when expanded */}
            {toolName === 'generate_video' && (toolResult?.output?.videos || hasError) && (
              <div className="mt-2 text-muted-foreground">
                <div className="space-y-3">
                  {/* Original prompt */}
                  {log.message && (
                    <div>
                      <strong>Prompt:</strong>
                      <div className="mt-1 p-2 bg-muted/30 rounded text-sm">
                        {log.message}
                      </div>
                    </div>
                  )}
                  
                  {/* Generation details */}
                  {toolResult.output.metadata && (
                    <div>
                      <strong>Generation Details:</strong>
                      <div className="mt-1 text-xs bg-muted/30 rounded p-2">
                        <div className="grid grid-cols-2 gap-2">
                          {toolResult.output.metadata.aspectRatio && (
                            <div>
                              <span className="font-medium">Aspect Ratio:</span> {toolResult.output.metadata.aspectRatio}
                            </div>
                          )}
                          {toolResult.output.metadata.resolution && (
                            <div>
                              <span className="font-medium">Resolution:</span> {toolResult.output.metadata.resolution}
                            </div>
                          )}
                          {toolResult.output.metadata.duration && (
                            <div>
                              <span className="font-medium">Duration:</span> {toolResult.output.metadata.duration}s
                            </div>
                          )}
                          {toolResult.output.metadata.generated_at && (
                            <div>
                              <span className="font-medium">Generated:</span> {new Date(toolResult.output.metadata.generated_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Success message */}
                  {toolResult.output.message && (
                    <div>
                      <strong>Status:</strong>
                      <div className="mt-1 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded p-2">
                        {toolResult.output.message}
                      </div>
                    </div>
                  )}
                  
                  {/* Error display for failed video generation */}
                  {hasError && !toolResult?.output?.videos && (
                    <div>
                      <strong className="text-red-600">Error:</strong>
                      <div className="mt-1 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-3 border border-red-200 dark:border-red-800">
                        {errorMessage}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Error display for other tool types */}
            {hasError && toolName !== 'generate_image' && toolName !== 'generate_video' && (
              <div className="mt-2 text-muted-foreground">
                <div className="space-y-3">
                  {/* Error message */}
                  <div>
                    <strong className="text-red-600">Error:</strong>
                    <div className="mt-1 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-3 border border-red-200 dark:border-red-800">
                      {errorMessage}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {log.screenshot_base64 && (
              <div className="mt-2 text-muted-foreground">
                <strong>Screenshot:</strong>
                <div className="mt-2">
                  <img 
                    src={formatBase64Image(log.screenshot_base64)} 
                    alt="Tool Screenshot" 
                    className={isBrowserVisible ? "w-full h-auto rounded border shadow-sm" : "max-w-[33vw] h-auto rounded border shadow-sm"}
                    style={{ maxHeight: '400px', maxWidth: isBrowserVisible ? '100%' : undefined }}
                  />
                </div>
              </div>
            )}
            {toolResult && Object.keys(toolResult).length > 0 && toolName !== 'generate_image' && toolName !== 'generate_video' && (
              <div className="mt-2 text-muted-foreground">
                <strong>Result:</strong> 
                <div className="mt-1">
                  {renderObjectWithImages(toolResult, 0, isBrowserVisible)}
                </div>
              </div>
            )}
            {log.details && Object.keys(log.details).length > 0 && (
              <div className="mt-3 text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                  <strong className="text-sm text-blue-600">Details Overview:</strong>
                </div>
                <div 
                  className="rounded-lg p-3"
                  style={{ 
                    backgroundColor: isDarkMode ? '#1a1a2e' : '#f8f9fa',
                    border: 'none', 
                    boxShadow: 'none', 
                    outline: 'none',
                    filter: 'none'
                  }}
                >
                  {renderObjectWithImages(log.details, 0, isBrowserVisible)}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Fullscreen image viewer */}
      {toolName === 'generate_image' && toolResult?.output?.images && (
        <ImageFullscreenViewer
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
          images={toolResult.output.images}
          metadata={toolResult.output.metadata}
          prompt={log.message}
        />
      )}

      {/* Fullscreen video viewer */}
      {toolName === 'generate_video' && toolResult?.output?.videos && (
        <VideoFullscreenViewer
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
          videos={toolResult.output.videos}
          metadata={toolResult.output.metadata}
          prompt={log.message}
        />
      )}
    </div>
  )
}
