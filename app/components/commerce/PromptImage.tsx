"use client"

import type { ImgHTMLAttributes } from 'react'
import { normalizePromptImageUrl, type PromptImageDelivery } from '@/app/lib/prompt-image-url'
import { usePromptImageDelivery } from './PublicImageDelivery'

/** Native delivery avoids a relative Next optimizer hop on the separate www deployment. */
export function PromptImage({ src, srcSet, alt, delivery: override, ...props }: ImgHTMLAttributes<HTMLImageElement> & {
  delivery?: PromptImageDelivery
}) {
  const inherited = usePromptImageDelivery()
  const delivery = override || inherited
  const normalizedSrc = typeof src === 'string' ? normalizePromptImageUrl(src, undefined, delivery) : src
  const normalizedSrcSet = srcSet?.replace(/(\S+)(\s+(?:\d+w|\d*\.?\d+x))(?=\s*,|\s*$)/g,
    (_candidate, url: string, descriptor: string) => `${normalizePromptImageUrl(url, undefined, delivery)}${descriptor}`)
  return <img {...props} alt={alt} src={normalizedSrc} srcSet={normalizedSrcSet} />
}