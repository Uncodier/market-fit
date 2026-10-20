"use client"

import { useCallback, useState, type ImgHTMLAttributes } from 'react'
import { IMAGE_PLACEHOLDER_PATH, normalizePromptImageUrl, type PromptImageDelivery } from '@/app/lib/prompt-image-url'
import { usePromptImageDelivery } from './PublicImageDelivery'

/** Native delivery avoids a relative Next optimizer hop on the separate www deployment. */
export function PromptImage({ src, srcSet, alt, onError, delivery: override, ...props }: ImgHTMLAttributes<HTMLImageElement> & {
  delivery?: PromptImageDelivery
}) {
  const inherited = usePromptImageDelivery()
  const delivery = override || inherited
  const normalizedSrc = typeof src === 'string' ? normalizePromptImageUrl(src, undefined, delivery) : src
  const normalizedSrcSet = srcSet?.replace(/(\S+)(\s+(?:\d+w|\d*\.?\d+x))(?=\s*,|\s*$)/g,
    (_candidate, url: string, descriptor: string) => `${normalizePromptImageUrl(url, undefined, delivery)}${descriptor}`)
  const sourceKey = JSON.stringify([normalizedSrc, normalizedSrcSet])
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const isFallback = !normalizedSrc?.trim() || failedSource === sourceKey
  const placeholder = `${delivery?.origin || ''}${IMAGE_PLACEHOLDER_PATH}`
  const checkImage = useCallback((image: HTMLImageElement | null) => {
    // A cached failure may have fired before hydration attached the error handler.
    if (image && !isFallback && image.complete && image.naturalWidth === 0) {
      setFailedSource(sourceKey)
    }
  }, [isFallback, sourceKey])

  return <img
    {...props}
    key={sourceKey}
    ref={checkImage}
    alt={alt}
    src={isFallback ? placeholder : normalizedSrc}
    srcSet={isFallback ? undefined : normalizedSrcSet}
    data-image-fallback={isFallback ? 'true' : undefined}
    onError={(event) => {
      onError?.(event)
      // Do not retry generation or loop if the static placeholder is unavailable.
      if (!isFallback) setFailedSource(sourceKey)
    }}
  />
}