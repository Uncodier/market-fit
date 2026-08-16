"use client"

import React, { useState, useEffect } from "react"
import { resolveItemImage, type ItemImagePromptInput } from "@/app/lib/image-utils"
import type { ImageSizePreset } from "@/app/lib/optimize-storage-image"

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  item?: ItemImagePromptInput | null
  directUrl?: string | null
  alt?: string
  sizes?: string
  fallbackPreset?: ImageSizePreset
  className?: string
  fetchPriority?: "high" | "low" | "auto"
}

export const ProgressiveImage = React.memo(function ProgressiveImage({
  item,
  directUrl,
  alt = "",
  sizes = "100vw",
  fallbackPreset = "hero",
  className = "",
  loading = "lazy",
  fetchPriority = "auto",
  ...props
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  // Use the direct URL if provided, otherwise resolve via the catalog item.
  // Note: For directUrls we don't automatically generate srcSet variants.
  const src = directUrl || (item ? resolveItemImage(item, fallbackPreset) : "")
  
  const thumbUrl = directUrl ? directUrl : (item ? resolveItemImage(item, "thumb") : src)
  const cardUrl = directUrl ? directUrl : (item ? resolveItemImage(item, "card") : src)
  const heroUrl = directUrl ? directUrl : (item ? resolveItemImage(item, "hero") : src)

  // Reset load state if the base source changes
  useEffect(() => {
    setIsLoaded(false)
  }, [src])

  if (!src) return null

  const srcSet = (!directUrl && item) 
    ? `${thumbUrl} 128w, ${cardUrl} 400w, ${heroUrl} 800w`
    : undefined

  return (
    <>
      {/* Low-res blurred placeholder (always rendered beneath) */}
      <img
        src={thumbUrl}
        alt={alt}
        className={`${className} absolute inset-0 filter blur-xl scale-105`}
        aria-hidden="true"
        {...props}
      />
      
      {/* High-res image with fade-in transition */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          e.currentTarget.style.opacity = '0'
        }}
        className={`
          ${className} 
          absolute inset-0 
          transition-opacity duration-700 ease-out 
          ${isLoaded ? "opacity-100" : "opacity-0"}
        `}
        {...props}
      />
    </>
  )
})
