import React, { useState } from 'react'

interface GeneratedImageDisplayProps {
  toolResult: any
  isDarkMode: boolean
  onImageClick?: () => void
  isBrowserVisible?: boolean
}

export const GeneratedImageDisplay: React.FC<GeneratedImageDisplayProps> = ({
  toolResult,
  isDarkMode,
  isBrowserVisible = false
}) => {
  // Check if we have image URLs to display
  if (!toolResult?.output?.images || !Array.isArray(toolResult.output.images)) {
    return null
  }

  const { images } = toolResult.output

  return (
    <div className="space-y-3 inline-block">
      {/* Display generated images */}
      <div className="grid gap-3">
        {images.map((imageObj: any, index: number) => (
          <div key={index} className="relative">
            <img 
              src={imageObj?.url || imageObj} 
              alt={`Generated image ${index + 1}`}
              className={isBrowserVisible ? "w-full h-auto rounded-lg border shadow-sm" : "max-w-[33vw] h-auto rounded-lg border shadow-sm"}
              style={{ height: 'auto', maxWidth: isBrowserVisible ? '100%' : undefined }}
              loading="lazy"
            />
            <div className="text-xs text-muted-foreground/70 mt-1">
              Generated Image {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Component for collapsed view - only shows images
export const GeneratedImageDisplayCollapsed: React.FC<GeneratedImageDisplayProps> = ({
  toolResult,
  isDarkMode,
  onImageClick,
  isBrowserVisible = false
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  
  // Check if we have image URLs to display
  if (!toolResult?.output?.images || !Array.isArray(toolResult.output.images)) {
    return null
  }

  const { images } = toolResult.output

  // Single image - simple display
  if (images.length === 1) {
    return (
      <div className="grid gap-3 inline-block">
        <div className="relative">
          <img 
            src={images[0]?.url || images[0]} 
            alt="Generated image"
            className={isBrowserVisible ? "w-full h-auto rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity" : "max-w-[33vw] h-auto rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"}
            style={{ height: 'auto', maxWidth: isBrowserVisible ? '100%' : undefined }}
            loading="lazy"
            onClick={onImageClick}
          />
        </div>
      </div>
    )
  }

  // Multiple images - carousel with thumbnails
  return (
    <div className="space-y-3 inline-block">
      {/* Main image display */}
      <div className="relative">
        <img 
          src={images[selectedImageIndex]?.url || images[selectedImageIndex]} 
          alt={`Generated image ${selectedImageIndex + 1}`}
          className={isBrowserVisible ? "w-full h-auto rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity" : "max-w-[33vw] h-auto rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"}
          style={{ height: 'auto', maxWidth: isBrowserVisible ? '100%' : undefined }}
          loading="lazy"
          onClick={onImageClick}
        />
      </div>
      
      {/* Thumbnail carousel */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((imageObj: any, index: number) => (
          <button
            key={index}
            onClick={() => setSelectedImageIndex(index)}
            className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 transition-all duration-200 flex items-center justify-center overflow-hidden ${
              selectedImageIndex === index
                ? 'border-primary shadow-md'
                : 'border-muted-foreground/30 hover:border-muted-foreground/60'
            }`}
          >
            <img 
              src={imageObj?.url || imageObj} 
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
              style={{ width: '80px', height: '80px' }}
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
