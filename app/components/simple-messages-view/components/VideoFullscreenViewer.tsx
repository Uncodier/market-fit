"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/app/components/ui/dialog'
import { Download, Copy, Check, ChevronLeft, ChevronRight } from '@/app/components/ui/icons'
import { Button } from '@/app/components/ui/button'
import { useToast } from '@/app/components/ui/use-toast'

interface VideoFullscreenViewerProps {
  isOpen: boolean
  onClose: () => void
  videos: Array<{ url?: string; mimeType?: string } | string>
  metadata?: {
    aspectRatio?: string
    resolution?: string
    duration?: number
    generated_at?: string
    [key: string]: any
  }
  prompt?: string
}

export const VideoFullscreenViewer: React.FC<VideoFullscreenViewerProps> = ({
  isOpen,
  onClose,
  videos,
  metadata,
  prompt
}) => {
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { toast } = useToast()

  // Reset selected video when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedVideoIndex(0)
    }
  }, [isOpen])

  if (!videos || videos.length === 0) {
    return null
  }

  const currentVideo = videos[selectedVideoIndex]
  let videoUrl = typeof currentVideo === 'string' 
    ? currentVideo 
    : currentVideo?.url || ''
  
  // Convert Supabase URL to db.makinari.com and use proxy
  if (videoUrl.includes('supabase.co/storage')) {
    videoUrl = videoUrl.replace(/https?:\/\/[^\/]+\.supabase\.co/, 'https://db.makinari.com')
  }
  // Use proxy for videos to avoid CORS issues
  if (videoUrl.includes('db.makinari.com') || videoUrl.includes('supabase.co')) {
    videoUrl = `/api/assets/proxy?url=${encodeURIComponent(videoUrl)}`
  }
  
  const mimeType = typeof currentVideo === 'string' 
    ? 'video/mp4' 
    : currentVideo?.mimeType || 'video/mp4'

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedVideoIndex > 0) {
      setSelectedVideoIndex(selectedVideoIndex - 1)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedVideoIndex < videos.length - 1) {
      setSelectedVideoIndex(selectedVideoIndex + 1)
    }
  }

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(videoUrl)
      setCopied(true)
      toast({
        title: "Copied to clipboard",
        description: "Video URL has been copied",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
      toast({
        title: "Failed to copy",
        description: "Could not copy URL to clipboard",
        variant: "destructive"
      })
    }
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDownloading(true)
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `video-${selectedVideoIndex + 1}.${blob.type.split('/')[1] || 'mp4'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast({
        title: "Download started",
        description: "Video is being downloaded",
      })
    } catch (err) {
      console.error('Failed to download video:', err)
      toast({
        title: "Download failed",
        description: "Could not download video",
        variant: "destructive"
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === 'ArrowLeft' && selectedVideoIndex > 0) {
      setSelectedVideoIndex(selectedVideoIndex - 1)
    } else if (e.key === 'ArrowRight' && selectedVideoIndex < videos.length - 1) {
      setSelectedVideoIndex(selectedVideoIndex + 1)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown as any)
      return () => {
        window.removeEventListener('keydown', handleKeyDown as any)
      }
    }
  }, [isOpen, selectedVideoIndex, videos.length])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 gap-0 flex flex-row overflow-hidden sm:rounded-lg">
        {/* Left side: Video display */}
        <div className="flex-1 relative flex items-center justify-center bg-background overflow-hidden">
          {/* Navigation arrows */}
          {videos.length > 1 && (
            <>
              {selectedVideoIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
                  aria-label="Previous video"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              {selectedVideoIndex < videos.length - 1 && (
                <button
                  onClick={handleNext}
                  className="absolute right-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
                  aria-label="Next video"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </>
          )}

          {/* Video counter */}
          {videos.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border text-sm">
              {selectedVideoIndex + 1} / {videos.length}
            </div>
          )}

          {/* Video */}
          <video
            key={selectedVideoIndex}
            src={videoUrl}
            controls
            autoPlay
            className="max-w-full max-h-full"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          >
            <source src={videoUrl} type={mimeType} />
            <source src={videoUrl} type="video/mp4" />
            <source src={videoUrl} type="video/webm" />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Right side: Metadata panel */}
        <div className="w-[400px] border-l border-border bg-card overflow-y-auto flex flex-col">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Video Details</h3>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full"
                variant="default"
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? 'Downloading...' : 'Download Video'}
              </Button>
              <Button
                onClick={handleCopyUrl}
                className="w-full"
                variant="outline"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy URL
                  </>
                )}
              </Button>
            </div>

            {/* Metadata sections */}
            <div className="space-y-4">
              {/* Prompt */}
              {prompt && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Prompt</h4>
                  <div className="p-3 bg-muted/30 rounded text-sm">
                    {prompt}
                  </div>
                </div>
              )}

              {/* Video metadata */}
              {metadata && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Generation Details</h4>
                  <div className="space-y-2">
                    {metadata.aspectRatio && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Aspect Ratio:</span>
                        <span className="font-medium">{metadata.aspectRatio}</span>
                      </div>
                    )}
                    {metadata.resolution && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Resolution:</span>
                        <span className="font-medium">{metadata.resolution}</span>
                      </div>
                    )}
                    {metadata.duration && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-medium">{metadata.duration}s</span>
                      </div>
                    )}
                    {metadata.generated_at && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Generated:</span>
                        <span className="font-medium">
                          {new Date(metadata.generated_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Video URL */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Video URL</h4>
                <div className="p-3 bg-muted/30 rounded text-xs break-all font-mono">
                  {videoUrl}
                </div>
              </div>

              {/* Video info */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Video Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format:</span>
                    <span className="font-medium">
                      {videoUrl.split('.').pop()?.toUpperCase() || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Index:</span>
                    <span className="font-medium">
                      {selectedVideoIndex + 1} of {videos.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

