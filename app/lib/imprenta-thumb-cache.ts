"use client"

/**
 * LRU cache of decoded HTMLImageElements for canvas drawing.
 *
 * - Bounded entries (default 256) so memory stays flat on large graphs.
 * - Bounded decode concurrency so Safari does not stall on a burst of img.decode().
 * - Emits `onDecoded(url)` so canvases can schedule a single rAF repaint instead of
 *   repainting per-image load.
 *
 * Usage:
 *   const img = thumbCache.get(url)            // HTMLImageElement | null
 *   if (!img) thumbCache.request(url)          // async decode
 *   thumbCache.onDecoded((url) => scheduleRepaint())
 */
export type ThumbCacheStatus = "idle" | "loading" | "ready" | "error"

type CacheEntry = {
  url: string
  status: ThumbCacheStatus
  image: HTMLImageElement | HTMLCanvasElement | null
  /** Monotonic touch counter for LRU. */
  lastUsed: number
}

export type ImprentaThumbCache = {
  get: (url: string) => HTMLImageElement | HTMLCanvasElement | null
  status: (url: string) => ThumbCacheStatus
  /** Kick off a decode if not already loading/ready. No-op server-side. */
  request: (url: string) => void
  /** Mark a set of URLs as currently visible; releases decoded images outside the set when the cache is full. */
  touch: (urls: Iterable<string>) => void
  onDecoded: (listener: (url: string) => void) => () => void
  clear: () => void
  size: () => number
}

export interface ImprentaThumbCacheOptions {
  maxEntries?: number
  maxConcurrent?: number
}

export function createImprentaThumbCache(
  options: ImprentaThumbCacheOptions = {}
): ImprentaThumbCache {
  const maxEntries = Math.max(16, options.maxEntries ?? 256)
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 6)

  const entries = new Map<string, CacheEntry>()
  const listeners = new Set<(url: string) => void>()
  const queue: string[] = []
  let inFlight = 0
  let tick = 0

  const emitDecoded = (url: string) => {
    listeners.forEach((l) => {
      try {
        l(url)
      } catch (e) {
        console.error("ThumbCache listener:", e)
      }
    })
  }

  const pump = () => {
    if (typeof window === "undefined") return
    while (inFlight < maxConcurrent && queue.length > 0) {
      const url = queue.shift()!
      const entry = entries.get(url)
      if (!entry || entry.status !== "loading") continue

      inFlight++
      
      const done = (ok: boolean, resultImage: HTMLImageElement | HTMLCanvasElement | null) => {
        inFlight--
        const current = entries.get(url)
        if (current) {
          current.status = ok ? "ready" : "error"
          current.image = ok ? resultImage : null
          current.lastUsed = ++tick
        }
        if (ok) emitDecoded(url)
        pump()
      }

      const isVideo = url.match(/\.(mp4|webm|mov|m4v)(\?|#|$)/i)
      if (isVideo) {
        const video = document.createElement("video")
        video.crossOrigin = "anonymous"
        video.muted = true
        video.playsInline = true
        video.preload = "metadata"
        
        let handled = false
        const handleVideoError = () => {
          if (handled) return
          handled = true
          done(false, null)
        }

        const extractFrame = () => {
          if (handled) return
          handled = true
          try {
            const canvas = document.createElement("canvas")
            canvas.width = video.videoWidth || 640
            canvas.height = video.videoHeight || 360
            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              done(true, canvas)
            } else {
              done(false, null)
            }
          } catch (e) {
            done(false, null)
          }
          video.src = ""
          video.load()
        }

        video.addEventListener("error", handleVideoError)
        video.addEventListener("loadeddata", () => {
          if (handled) return
          if (video.currentTime !== 0.001) {
            video.currentTime = 0.001
          } else {
            // Already at 0.001, extract immediately
            extractFrame()
          }
        })
        video.addEventListener("seeked", extractFrame)
        // Timeout to prevent hanging
        setTimeout(() => {
          if (!handled) handleVideoError()
        }, 8000)

        video.src = url
        video.load()
      } else {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.decoding = "async"
        ;(img as unknown as { fetchPriority?: string }).fetchPriority = "low"
        
        img.onload = () => {
          // Prefer img.decode when available to move bitmap build off the main thread.
          if (typeof img.decode === "function") {
            img.decode().then(() => done(true, img)).catch(() => done(true, img))
          } else {
            done(true, img)
          }
        }
        img.onerror = () => done(false, null)
        try {
          img.src = url
        } catch {
          done(false, null)
        }
      }
    }
  }

  const evictIfNeeded = (protectedUrls?: Set<string>) => {
    if (entries.size <= maxEntries) return
    // Evict least-recently used, never touching loading or protected entries.
    const candidates: CacheEntry[] = []
    entries.forEach((e) => {
      if (e.status === "loading") return
      if (protectedUrls && protectedUrls.has(e.url)) return
      candidates.push(e)
    })
    candidates.sort((a, b) => a.lastUsed - b.lastUsed)
    const toDrop = entries.size - maxEntries
    for (let i = 0; i < toDrop && i < candidates.length; i++) {
      const c = candidates[i]
      if (c.image) {
        if (c.image instanceof HTMLImageElement) {
          try {
            c.image.src = ""
          } catch {
            /* ignore */
          }
        } else if (c.image instanceof HTMLCanvasElement) {
          c.image.width = 0
          c.image.height = 0
        }
      }
      entries.delete(c.url)
    }
  }

  return {
    get(url) {
      const e = entries.get(url)
      if (!e) return null
      e.lastUsed = ++tick
      return e.status === "ready" ? e.image : null
    },
    status(url) {
      return entries.get(url)?.status ?? "idle"
    },
    request(url) {
      if (typeof window === "undefined") return
      if (!url) return
      const existing = entries.get(url)
      if (existing) {
        existing.lastUsed = ++tick
        return
      }
      entries.set(url, { url, status: "loading", image: null, lastUsed: ++tick })
      queue.push(url)
      pump()
    },
    touch(urls) {
      const protectedSet = new Set<string>()
      const visit = (url: string) => {
        const e = entries.get(url)
        if (e) {
          e.lastUsed = ++tick
          protectedSet.add(url)
        }
      }
      if (Array.isArray(urls)) {
        for (let i = 0; i < urls.length; i++) visit(urls[i])
      } else {
        const anyUrls = urls as unknown as { forEach?: (cb: (u: string) => void) => void }
        if (typeof anyUrls.forEach === "function") {
          anyUrls.forEach(visit)
        } else {
          const it = (urls as Iterable<string>)[Symbol.iterator]()
          let r = it.next()
          while (!r.done) {
            visit(r.value)
            r = it.next()
          }
        }
      }
      evictIfNeeded(protectedSet)
    },
    onDecoded(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    clear() {
      entries.forEach((e) => {
        if (e.image) {
          if (e.image instanceof HTMLImageElement) {
            try {
              e.image.src = ""
            } catch {
              /* ignore */
            }
          } else if (e.image instanceof HTMLCanvasElement) {
            e.image.width = 0
            e.image.height = 0
          }
        }
      })
      entries.clear()
      queue.length = 0
      inFlight = 0
    },
    size() {
      return entries.size
    },
  }
}

let sharedCache: ImprentaThumbCache | null = null
/** Shared singleton for the Imprenta lite canvas layer. */
export function getImprentaThumbCache(): ImprentaThumbCache {
  if (!sharedCache) sharedCache = createImprentaThumbCache()
  return sharedCache
}
