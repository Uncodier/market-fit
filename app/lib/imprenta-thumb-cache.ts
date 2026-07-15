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
  image: HTMLCanvasElement | null
  /**
   * Object URL of the downscaled bitmap (JPEG/PNG blob). DOM cards use this instead
   * of the original full-res URL so Safari never decodes/resamples 2-4K images on
   * the main thread while painting hundreds of cards.
   */
  displayUrl: string | null
  /** Monotonic touch counter for LRU. */
  lastUsed: number
}

export type ImprentaThumbCache = {
  get: (url: string) => HTMLCanvasElement | null
  /** Downscaled object URL for DOM <img> usage; null until encoded. */
  getDisplayUrl: (url: string) => string | null
  status: (url: string) => ThumbCacheStatus
  /** Kick off a decode if not already loading/ready. No-op server-side. */
  request: (url: string) => void
  /** Mark a set of URLs as currently visible; releases decoded images outside the set when the cache is full. */
  touch: (urls: Iterable<string>) => void
  /** Fires when an entry reaches a terminal state (ready or error) and again when its displayUrl becomes available. */
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
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 10)
  // Video poster extraction holds a media element (and its network connection) for
  // seconds. A separate low cap keeps videos from starving image downloads — Safari
  // only allows ~6 connections per host, so video hogs made images "never finish".
  const maxConcurrentVideo = 2

  const entries = new Map<string, CacheEntry>()
  const listeners = new Set<(url: string) => void>()
  const queue: string[] = []
  let inFlight = 0
  let inFlightVideo = 0
  let tick = 0

  const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)

  // --- Dev diagnostics: track what stage each in-flight item is in so stalls are
  // visible in the console instead of silently wedging the queue (Safari). ---
  const DEBUG = typeof process !== "undefined" && process.env.NODE_ENV !== "production"
  const inFlightStages = new Map<string, { stage: string; startedAt: number }>()
  let statsTimer: ReturnType<typeof setInterval> | null = null
  const setStage = (url: string, stage: string) => {
    const s = inFlightStages.get(url)
    if (s) s.stage = stage
    else inFlightStages.set(url, { stage, startedAt: Date.now() })
  }
  const ensureStatsLogger = () => {
    if (!DEBUG || statsTimer) return
    statsTimer = setInterval(() => {
      if (inFlight === 0 && queue.length === 0) {
        if (statsTimer) clearInterval(statsTimer)
        statsTimer = null
        return
      }
      let ready = 0
      let error = 0
      entries.forEach((e) => {
        if (e.status === "ready") ready++
        else if (e.status === "error") error++
      })
      const now = Date.now()
      const slow: string[] = []
      inFlightStages.forEach((s, u) => {
        if (now - s.startedAt > 4000) {
          slow.push(`${u.slice(-40)} @${s.stage} ${Math.round((now - s.startedAt) / 1000)}s`)
        }
      })
      console.info(
        `[imprenta-thumb] queue=${queue.length} inFlight=${inFlight} (video=${inFlightVideo}) ready=${ready} error=${error}` +
          (slow.length ? `\n  slow: ${slow.join("\n  slow: ")}` : "")
      )
    }, 3000)
  }

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
      // Pick the next eligible item: skip videos when the video lane is full so
      // images keep flowing (images are prioritized within the shared budget).
      let idx = -1
      for (let i = 0; i < queue.length; i++) {
        if (isVideoUrl(queue[i])) {
          if (inFlightVideo < maxConcurrentVideo) {
            idx = i
            break
          }
        } else {
          idx = i
          break
        }
      }
      if (idx === -1) return
      const url = queue.splice(idx, 1)[0]
      const entry = entries.get(url)
      if (!entry || entry.status !== "loading") continue

      inFlight++
      const countsAsVideo = isVideoUrl(url)
      if (countsAsVideo) inFlightVideo++
      setStage(url, "start")
      ensureStatsLogger()

      let doneCalled = false
      let watchdog: ReturnType<typeof setTimeout> | null = null
      const done = (ok: boolean, resultImage: HTMLCanvasElement | null) => {
        if (doneCalled) return
        doneCalled = true
        if (watchdog) clearTimeout(watchdog)
        if (DEBUG) {
          const s = inFlightStages.get(url)
          if (s && Date.now() - s.startedAt > 4000) {
            console.warn(
              `[imprenta-thumb] slow item (${Math.round((Date.now() - s.startedAt) / 1000)}s, last stage: ${s.stage}, ok=${ok}): ${url}`
            )
          }
        }
        inFlightStages.delete(url)
        inFlight--
        if (countsAsVideo) inFlightVideo--
        const current = entries.get(url)
        if (current) {
          current.status = ok ? "ready" : "error"
          current.image = ok ? resultImage : null
          current.lastUsed = ++tick
        }
        // Emit on both ready and error so DOM consumers can fall back to the original URL.
        emitDecoded(url)
        // Encode a compressed display blob asynchronously; second emit when ready.
        // On any failure fall back to the original URL so DOM consumers never wait forever.
        if (ok && resultImage && typeof resultImage.toBlob === "function") {
          const mime = /\.png(\?|#|$)/i.test(url) ? "image/png" : "image/jpeg"
          const fallbackToOriginal = () => {
            const cur = entries.get(url)
            if (cur && !cur.displayUrl) {
              cur.displayUrl = url
              emitDecoded(url)
            }
          }
          try {
            resultImage.toBlob(
              (blob) => {
                const cur = entries.get(url)
                if (!cur || cur.displayUrl) return
                if (blob) {
                  cur.displayUrl = URL.createObjectURL(blob)
                  emitDecoded(url)
                } else {
                  fallbackToOriginal()
                }
              },
              mime,
              0.85
            )
          } catch {
            fallbackToOriginal()
          }
        }
        pump()
      }

      // Hard watchdog: no matter which path wedges (fetch that never settles,
      // decode that never resolves), the slot is always released. DOM consumers
      // get the error emit and fall back to the original URL.
      watchdog = setTimeout(() => {
        if (!doneCalled) {
          if (DEBUG) {
            const s = inFlightStages.get(url)
            console.warn(`[imprenta-thumb] watchdog fired (stage: ${s?.stage ?? "?"}): ${url}`)
          }
          done(false, null)
        }
      }, 15000)

      if (countsAsVideo) {
        const TARGET = Math.round(512 * (window.devicePixelRatio || 1))
        const video = document.createElement("video")
        video.crossOrigin = "anonymous"
        video.muted = true
        video.playsInline = true
        // "metadata" + seek on loadedmetadata: Safari then range-requests just the
        // frame we need. preload="auto" made Safari download entire files, saturating
        // the per-host connection limit and starving image fetches.
        video.preload = "metadata"

        let handled = false
        let seeked = false
        const cleanup = () => {
          video.removeAttribute("src")
          video.load()
        }
        const handleVideoError = () => {
          if (handled) return
          handled = true
          cleanup()
          done(false, null)
        }

        const extractFrame = () => {
          if (handled) return
          // Safari can fire `seeked` before the frame is actually decodable; drawing
          // then produces a black poster. Wait until we have current-frame data.
          if (video.readyState < 2) return
          handled = true
          try {
            const vw = video.videoWidth || 640
            const vh = video.videoHeight || 360
            const scale = Math.min(1, TARGET / vw)
            const canvas = document.createElement("canvas")
            canvas.width = Math.max(1, Math.round(vw * scale))
            canvas.height = Math.max(1, Math.round(vh * scale))
            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.imageSmoothingEnabled = true
              ;(ctx as any).imageSmoothingQuality = "medium"
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              done(true, canvas)
            } else {
              done(false, null)
            }
          } catch (e) {
            done(false, null)
          }
          cleanup()
        }

        const trySeek = () => {
          if (handled || seeked) return
          if (video.readyState < 1) return
          seeked = true
          try {
            video.currentTime = 0.001
          } catch {
            /* extract on canplay instead */
          }
        }

        setStage(url, "video-load")
        video.addEventListener("error", handleVideoError)
        video.addEventListener("loadedmetadata", () => {
          setStage(url, "video-seek")
          trySeek()
        })
        video.addEventListener("loadeddata", () => {
          trySeek()
          extractFrame()
        })
        video.addEventListener("seeked", extractFrame)
        video.addEventListener("canplay", extractFrame)
        // Timeout to prevent hanging
        setTimeout(() => {
          if (!handled) handleVideoError()
        }, 8000)

        video.src = url
        video.load()
      } else {
        const TARGET = Math.round(512 * (window.devicePixelRatio || 1))
        
        const processWithImageFallback = () => {
          setStage(url, "img-fallback")
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.decoding = "async"
          ;(img as unknown as { fetchPriority?: string }).fetchPriority = "low"
          
          img.onload = async () => {
            setStage(url, "img-fallback-decode")
            if (typeof createImageBitmap === "function") {
              try {
                const bitmap = await createImageBitmap(img)
                const scale = Math.min(1, TARGET / bitmap.width)
                const canvas = document.createElement("canvas")
                canvas.width = bitmap.width * scale
                canvas.height = bitmap.height * scale
                const ctx = canvas.getContext("2d")
                if (ctx) {
                  ctx.imageSmoothingEnabled = true
                  ;(ctx as any).imageSmoothingQuality = "medium"
                  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
                  done(true, canvas)
                } else {
                  done(false, null)
                }
                bitmap.close()
                img.src = ""
                return
              } catch (e) {
                // fall through to fallback
              }
            }
            
            // Fallback a dibujar a un canvas offscreen directo
            const iw = img.naturalWidth || 1
            const ih = img.naturalHeight || 1
            const scale = Math.min(1, TARGET / iw)
            const canvas = document.createElement("canvas")
            canvas.width = iw * scale
            canvas.height = ih * scale
            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.imageSmoothingEnabled = true
              ;(ctx as any).imageSmoothingQuality = "medium"
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              img.src = ""
              done(true, canvas)
            } else {
              img.src = ""
              done(false, null)
            }
          }
          img.onerror = () => done(false, null)
          try {
            img.src = url
          } catch {
            done(false, null)
          }
        }

        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
          // Intentar fetch -> blob -> createImageBitmap. Abort after 10s so a hung
          // connection falls back to the <img> path instead of wedging the slot.
          setStage(url, "fetch")
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null
          const abortTimer = controller ? setTimeout(() => controller.abort(), 10000) : null
          // Distinguish HTTP errors (404 etc.) from CORS/network failures: retrying a
          // missing object via the <img> fallback just repeats the same 404.
          let httpStatusFailed = false
          fetch(url, { mode: 'cors', signal: controller?.signal })
            .then(res => {
              if (!res.ok) {
                httpStatusFailed = true
                throw new Error(`HTTP ${res.status}`)
              }
              setStage(url, "blob")
              return res.blob()
            })
            .then(blob => {
              if (abortTimer) clearTimeout(abortTimer)
              setStage(url, "decode")
              if (typeof createImageBitmap === 'function') {
                return createImageBitmap(blob).then(bitmap => {
                  setStage(url, "draw")
                  const scale = Math.min(1, TARGET / bitmap.width)
                  const canvas = document.createElement("canvas")
                  canvas.width = bitmap.width * scale
                  canvas.height = bitmap.height * scale
                  const ctx = canvas.getContext("2d")
                  if (ctx) {
                    ctx.imageSmoothingEnabled = true
                    ;(ctx as any).imageSmoothingQuality = "medium"
                    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
                    done(true, canvas)
                  } else {
                    done(false, null)
                  }
                  bitmap.close()
                })
              } else {
                throw new Error('createImageBitmap not available')
              }
            })
            .catch((err) => {
              if (abortTimer) clearTimeout(abortTimer)
              if (DEBUG) console.warn(`[imprenta-thumb] fetch path failed (${err?.message ?? err?.name ?? err}): ${url.slice(-60)}`)
              if (httpStatusFailed) {
                // The object does not exist (404/403); no fallback will fix that.
                done(false, null)
                return
              }
              // CORS failure, timeout, or createImageBitmap unsupported
              processWithImageFallback()
            })
        } else {
          processWithImageFallback()
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
        if (c.image instanceof HTMLCanvasElement) {
          c.image.width = 0
          c.image.height = 0
        }
      }
      if (c.displayUrl) {
        try {
          URL.revokeObjectURL(c.displayUrl)
        } catch {
          /* ignore */
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
    getDisplayUrl(url) {
      const e = entries.get(url)
      if (!e) return null
      e.lastUsed = ++tick
      return e.displayUrl
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
      entries.set(url, { url, status: "loading", image: null, displayUrl: null, lastUsed: ++tick })
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
          if (e.image instanceof HTMLCanvasElement) {
            e.image.width = 0
            e.image.height = 0
          }
        }
        if (e.displayUrl) {
          try {
            URL.revokeObjectURL(e.displayUrl)
          } catch {
            /* ignore */
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
