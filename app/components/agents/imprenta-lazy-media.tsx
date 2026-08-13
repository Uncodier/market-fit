"use client"

import { useEffect, useState, useRef } from "react"
import { getImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"
import { imprentaVideoManager } from "@/app/lib/imprenta-video-playback"

/** Show the original asset if the downscaled blob is still pending after this. */
const PROGRESSIVE_FALLBACK_MS = 1000

/**
 * Resolve a display URL for a media asset via the shared thumb cache.
 *
 * Prefers the compressed object URL when ready; otherwise paints the original
 * URL after decode completes (toBlob gap) or after a short loading timeout so
 * completed RESULT cards are not stuck on a grey skeleton.
 */
function useImprentaDisplayUrl(
  url: string,
  enabled = true,
  priority = false
): string | null {
  const [displayUrl, setDisplayUrl] = useState<string | null>(() => {
    if (!enabled || !url) return null
    return getImprentaThumbCache().getDisplayUrl(url)
  })

  useEffect(() => {
    if (!enabled || !url) {
      setDisplayUrl(null)
      return
    }
    const cache = getImprentaThumbCache()

    const resolve = () => {
      const blob = cache.getDisplayUrl(url)
      if (blob) return blob
      const status = cache.status(url)
      // Ready but toBlob still pending, or terminal error: paint original ASAP.
      if (status === "ready" || status === "error") return url
      return null
    }

    const initial = resolve()
    setDisplayUrl(initial)

    if (priority) cache.requestPriority(url)
    else cache.request(url)

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    if (!cache.getDisplayUrl(url) && cache.status(url) !== "error") {
      timeoutId = setTimeout(() => {
        setDisplayUrl((current) => {
          const blob = cache.getDisplayUrl(url)
          if (blob) return blob
          return current ?? url
        })
      }, PROGRESSIVE_FALLBACK_MS)
    }

    const unsub = cache.onDecoded((decodedUrl) => {
      if (decodedUrl !== url) return
      const blob = cache.getDisplayUrl(url)
      if (blob) {
        setDisplayUrl(blob)
        return
      }
      const next = resolve()
      if (next) setDisplayUrl(next)
    })

    return () => {
      unsub()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [url, enabled, priority])

  return displayUrl
}

/** Lite / graph shells: skeleton until decode; served from the downscaled display cache. */
export function ImprentaLazyPreviewImage({
  url,
  className,
  width,
  height,
  priority = false,
}: {
  url: string
  className?: string
  width: number
  height: number
  /** When true, fetch earlier (zoom band close to full card). */
  priority?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [useOriginal, setUseOriginal] = useState(false)
  const displayUrl = useImprentaDisplayUrl(url, true, priority)
  const src = useOriginal ? url : displayUrl

  useEffect(() => {
    setLoaded(false)
    setUseOriginal(false)
  }, [url])

  return (
    <span className="relative block h-full w-full min-h-0">
      <span
        className={`absolute inset-0 z-0 flex animate-pulse items-center justify-center rounded-[inherit] bg-muted/75 dark:bg-muted/60 transition-opacity duration-300 ${
          loaded ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-hidden
      >
        <span className="sr-only">Loading preview</span>
      </span>
      {src && (
        <img
          src={src}
          alt=""
          width={width}
          height={height}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            // Blob URL blocked/revoked: retry once with the original asset URL.
            if (!useOriginal && src !== url) setUseOriginal(true)
            else setLoaded(true)
          }}
          className={`relative z-[1] h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-95" : "opacity-0"
          } ${className ?? ""}`}
        />
      )}
    </span>
  )
}

export function ImprentaLazyPreviewVideo({
  url,
  className,
  priority = false,
  scale = 1,
}: {
  url: string
  className?: string
  priority?: boolean
  scale?: number
}) {
  const [ready, setReady] = useState(false)
  const [inViewport, setInViewport] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLSpanElement>(null)

  // Poster: downscaled first frame from the thumb cache. The real <video> mounts
  // only on play intent so Safari never holds dozens of decoders at once.
  const rawPosterUrl = useImprentaDisplayUrl(
    url,
    inViewport && !shouldMountVideo,
    priority
  )
  const [posterFailed, setPosterFailed] = useState(false)
  // A video URL can't render inside <img>; only use blob/object URLs as poster.
  const posterUrl = !posterFailed && rawPosterUrl && rawPosterUrl !== url ? rawPosterUrl : null

  useEffect(() => {
    setReady(false)
    setShouldMountVideo(false)
    setPosterFailed(false)
  }, [url])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setInViewport(entry.isIntersecting)
      },
      { rootMargin: "200px" } // Load slightly before it comes into view
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const shouldPlay = isHovered || scale >= 0.7

    if (shouldPlay && inViewport) {
      setShouldMountVideo(true)
    }
  }, [inViewport, isHovered, scale])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const shouldPlay = isHovered || scale >= 0.7

    if (shouldPlay && inViewport) {
      imprentaVideoManager.acquire(video)
    } else {
      imprentaVideoManager.release(video)
    }

    return () => {
      imprentaVideoManager.release(video)
    }
  }, [inViewport, isHovered, scale, url, shouldMountVideo])

  const effectiveUrl = inViewport ? (url.includes('#') ? url : `${url}#t=0.001`) : ''
  const showSkeleton = shouldMountVideo ? !ready : !posterUrl

  return (
    <span 
      ref={containerRef} 
      className="relative block h-full w-full min-h-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`absolute inset-0 z-0 flex animate-pulse items-center justify-center rounded-[inherit] bg-muted/75 dark:bg-muted/60 transition-opacity duration-300 ${
          showSkeleton ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      >
        <span className="sr-only">Loading video preview</span>
      </span>
      {shouldMountVideo ? (
        <video
          ref={videoRef}
          src={effectiveUrl || undefined}
          muted
          playsInline
          loop
          preload={priority ? "auto" : "metadata"}
          poster={posterUrl ?? undefined}
          className={`relative z-[1] h-full w-full object-cover transition-opacity duration-300 ${
            ready ? "opacity-95" : "opacity-0"
          } ${className ?? ""}`}
          aria-hidden
          onLoadedData={() => setReady(true)}
          onError={() => setReady(true)}
        />
      ) : posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setPosterFailed(true)}
          className={`relative z-[1] h-full w-full object-cover opacity-95 ${className ?? ""}`}
          aria-hidden
        />
      ) : null}
    </span>
  )
}

/** Full node card: reserved space + pulse so media does not pop in without context. */
export function ImprentaLazyCardImage({
  url,
  className,
  onOpen,
  alt = "Generated media",
  aspectRatio = "1/1",
  bleed = false,
}: {
  url: string
  className?: string
  onOpen: () => void
  alt?: string
  /** CSS aspect-ratio so the card footprint stays stable as the bitmap loads. */
  aspectRatio?: string
  /** Edge-to-edge inside a rounded card; skip the inner media radius. */
  bleed?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [useOriginal, setUseOriginal] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  // Full cards are few and visible — prioritize ahead of lite background previews.
  const displayUrl = useImprentaDisplayUrl(url, true, true)
  const src = useOriginal ? url : displayUrl

  useEffect(() => {
    setUseOriginal(false)
  }, [url])

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true)
    } else {
      setLoaded(false)
    }
  }, [url, src])

  return (
    <div
      className={`relative w-full overflow-hidden bg-black/10 ${bleed ? "rounded-none" : "rounded-xl"}`}
      style={{ aspectRatio }}
    >
      <div
        className={`absolute inset-0 z-0 flex animate-pulse items-center justify-center bg-muted/70 dark:bg-muted/55 transition-opacity duration-300 ${
          loaded ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-busy={!loaded}
        aria-hidden={loaded}
      >
        <span className="sr-only">Loading image</span>
      </div>
      {src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            // Blob URL blocked/revoked: retry once with the original asset URL.
            if (!useOriginal && src !== url) setUseOriginal(true)
            else setLoaded(true)
          }}
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className={`absolute inset-0 z-[1] h-full w-full object-cover cursor-pointer transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${className ?? ""}`}
        />
      )}
    </div>
  )
}
