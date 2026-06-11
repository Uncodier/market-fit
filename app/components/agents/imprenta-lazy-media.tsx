"use client"

import { useEffect, useState, useRef } from "react"

/** Lite / graph shells: skeleton until decode; lazy by default, eager when nearly full-detail zoom. */
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

  useEffect(() => {
    setLoaded(false)
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
      <img
        src={url}
        alt=""
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`relative z-[1] h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-95" : "opacity-0"
        } ${className ?? ""}`}
      />
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setReady(false)
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
    const video = videoRef.current
    if (!video || !inViewport) return

    const shouldPlay = isHovered || scale >= 0.7

    if (shouldPlay) {
      video.play().catch(() => {
        // Ignore auto-play errors
      })
    } else {
      video.pause()
    }
  }, [inViewport, isHovered, scale, url])

  const effectiveUrl = inViewport ? (url.includes('#') ? url : `${url}#t=0.001`) : ''

  return (
    <span 
      ref={containerRef} 
      className="relative block h-full w-full min-h-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`absolute inset-0 z-0 flex animate-pulse items-center justify-center rounded-[inherit] bg-muted/75 dark:bg-muted/60 transition-opacity duration-300 ${
          ready ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-hidden
      >
        <span className="sr-only">Loading video preview</span>
      </span>
      <video
        ref={videoRef}
        src={effectiveUrl || undefined}
        muted
        playsInline
        preload={priority ? "auto" : "metadata"}
        className={`relative z-[1] h-full w-full object-cover transition-opacity duration-300 ${
          ready ? "opacity-95" : "opacity-0"
        } ${className ?? ""}`}
        aria-hidden
        onLoadedData={() => setReady(true)}
        onError={() => setReady(true)}
      />
    </span>
  )
}

/** Full node card: reserved space + pulse so media does not pop in without context. */
export function ImprentaLazyCardImage({
  url,
  className,
  onOpen,
  alt = "Generated media",
}: {
  url: string
  className?: string
  onOpen: () => void
  alt?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true)
    } else {
      setLoaded(false)
    }
  }, [url])

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black/10">
      <div
        className={`absolute inset-0 z-0 flex animate-pulse items-center justify-center bg-muted/70 dark:bg-muted/55 transition-opacity duration-300 ${
          loaded ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-busy={!loaded}
        aria-hidden={loaded}
      >
        <span className="sr-only">Loading image</span>
      </div>
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        className={`relative z-[1] w-full h-auto max-h-[800px] object-contain cursor-pointer transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className ?? ""}`}
      />
    </div>
  )
}
