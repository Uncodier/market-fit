"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/app/components/ui/dialog'
import { Download, Copy, Check, ChevronLeft, ChevronRight, X } from '@/app/components/ui/icons'
import { Button } from '@/app/components/ui/button'
import { useToast } from '@/app/components/ui/use-toast'

interface ImageFullscreenViewerProps {
  isOpen: boolean
  onClose: () => void
  images: Array<{ url?: string } | string>
  metadata?: {
    size?: string
    quality?: string
    generated_at?: string
    [key: string]: any
  }
  prompt?: string
}

export const ImageFullscreenViewer: React.FC<ImageFullscreenViewerProps> = ({
  isOpen,
  onClose,
  images,
  metadata,
  prompt
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { toast } = useToast()

  // Reset selected image when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedImageIndex(0)
    }
  }, [isOpen])

  if (!images || images.length === 0) {
    return null
  }

  const currentImage = images[selectedImageIndex]
  const imageUrl = typeof currentImage === 'string' ? currentImage : currentImage?.url || ''

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1)
    }
  }

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(imageUrl)
      setCopied(true)
      toast({
        title: "Copied to clipboard",
        description: "Image URL has been copied",
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
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `image-${selectedImageIndex + 1}.${blob.type.split('/')[1] || 'png'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast({
        title: "Download started",
        description: "Image is being downloaded",
      })
    } catch (err) {
      console.error('Failed to download image:', err)
      toast({
        title: "Download failed",
        description: "Could not download image",
        variant: "destructive"
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
    } else if (e.key === 'ArrowRight' && selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1)
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
  }, [isOpen, selectedImageIndex, images.length])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 gap-0 flex flex-row overflow-hidden sm:rounded-lg">
        {/* Left side: Image display */}
        <div className="flex-1 relative flex items-center justify-center bg-background overflow-hidden">
          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              {selectedImageIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              {selectedImageIndex < images.length - 1 && (
                <button
                  onClick={handleNext}
                  className="absolute right-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </>
          )}

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border text-sm">
              {selectedImageIndex + 1} / {images.length}
            </div>
          )}

          {/* Image */}
          <img
            src={imageUrl}
            alt={`Image ${selectedImageIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        </div>

        {/* Right side: Metadata panel */}
        <div className="w-[400px] border-l border-border bg-card overflow-y-auto flex flex-col">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Image Details</h3>
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
                {isDownloading ? 'Downloading...' : 'Download Image'}
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

              {/* Image metadata */}
              {metadata && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Generation Details</h4>
                  <div className="space-y-2">
                    {metadata.size && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Size:</span>
                        <span className="font-medium">{metadata.size}</span>
                      </div>
                    )}
                    {metadata.quality && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quality:</span>
                        <span className="font-medium">{metadata.quality}</span>
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

              {/* Image URL */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Image URL</h4>
                <div className="p-3 bg-muted/30 rounded text-xs break-all font-mono">
                  {imageUrl}
                </div>
              </div>

              {/* Image info */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Image Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format:</span>
                    <span className="font-medium">
                      {imageUrl.split('.').pop()?.toUpperCase() || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Index:</span>
                    <span className="font-medium">
                      {selectedImageIndex + 1} of {images.length}
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

