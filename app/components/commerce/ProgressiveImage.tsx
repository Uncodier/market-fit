"use client"

import React, { useState } from "react"
import { resolveItemImage, type ItemImagePromptInput } from "@/app/lib/image-utils"
import type { ImageSizePreset } from "@/app/lib/optimize-storage-image"
import { normalizePromptImageUrl, type PromptImageDelivery } from "@/app/lib/prompt-image-url"
import { usePromptImageDelivery } from './PublicImageDelivery'
import { PromptImage } from './PromptImage'

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  item?: ItemImagePromptInput | null
  directUrl?: string | null
  delivery?: PromptImageDelivery
  alt?: string
  sizes?: string
  fallbackPreset?: ImageSizePreset
  className?: string
  fetchPriority?: "high" | "low" | "auto"
}

export const ProgressiveImage = React.memo(function ProgressiveImage({
  item,
  directUrl,
  delivery: override,
  alt = "",
  sizes = "100vw",
  fallbackPreset = "hero",
  className = "",
  loading = "lazy",
  fetchPriority = "auto",
  ...props
}: ProgressiveImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const inherited = usePromptImageDelivery()
  const delivery = override || inherited

  // Use the direct URL if provided, otherwise resolve via the catalog item.
  // Note: For directUrls we don't automatically generate srcSet variants.
  const normalizedDirect = directUrl ? normalizePromptImageUrl(directUrl, item?.site_id || item?.site?.id, delivery) : null
  const src = normalizedDirect || (item ? resolveItemImage(item, fallbackPreset, delivery) : "")
  
  const thumbUrl = normalizedDirect || (item ? resolveItemImage(item, "thumb", delivery) : src)
  const cardUrl = normalizedDirect || (item ? resolveItemImage(item, "card", delivery) : src)
  const heroUrl = normalizedDirect || (item ? resolveItemImage(item, "hero", delivery) : src)

  const isLoaded = loadedSrc === src

  if (!src) return null

  const srcSet = (!directUrl && item) 
    ? `${thumbUrl} 128w, ${cardUrl} 400w, ${heroUrl} 800w`
    : undefined

  return (
    <>
      {/* Low-res blurred placeholder (always rendered beneath) */}
      <PromptImage
        delivery={delivery}
        src={thumbUrl}
        alt={alt}
        className={`${className} absolute inset-0 w-full h-full filter blur-xl scale-105`}
        aria-hidden="true"
        {...props}
      />
      
      {/* High-res image with fade-in transition */}
      <PromptImage
        delivery={delivery}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onLoad={() => setLoadedSrc(src)}
        onError={(e) => {
          e.currentTarget.style.opacity = '0'
        }}
        className={`${className} absolute inset-0 w-full h-full transition-opacity duration-700 ease-out ${isLoaded ? "opacity-100" : "opacity-0"}`}
        {...props}
      />
    </>
  )
})
