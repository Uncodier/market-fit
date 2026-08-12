"use client"

import { IMAGE_SIZE_PX, IMAGE_SIZE_QUALITY, optimizeStorageImageUrl } from "@/app/lib/optimize-storage-image"

export type ThumbLoadDone = (ok: boolean, resultImage: HTMLCanvasElement | null) => void
export type ThumbSetStage = (url: string, stage: string) => void

function drawBitmapToTarget(
  bitmap: ImageBitmap | HTMLImageElement,
  target: number,
  done: ThumbLoadDone
): void {
  const iw =
    bitmap instanceof HTMLImageElement ? bitmap.naturalWidth || 1 : bitmap.width || 1
  const ih =
    bitmap instanceof HTMLImageElement ? bitmap.naturalHeight || 1 : bitmap.height || 1
  const scale = Math.min(1, target / iw)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(iw * scale))
  canvas.height = Math.max(1, Math.round(ih * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    done(false, null)
    return
  }
  ctx.imageSmoothingEnabled = true
  ;(ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality =
    "medium"
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  done(true, canvas)
}

function bitmapFromBlob(
  blob: Blob,
  target: number,
  setStage: ThumbSetStage,
  url: string,
  done: ThumbLoadDone
): Promise<void> {
  if (typeof createImageBitmap !== "function") {
    return Promise.reject(new Error("createImageBitmap not available"))
  }
  setStage(url, "decode")
  return createImageBitmap(blob).then((bitmap) => {
    setStage(url, "draw")
    drawBitmapToTarget(bitmap, target, done)
    bitmap.close()
  })
}

/** Extract a downscaled poster frame from a video URL. */
export function loadVideoThumb(
  url: string,
  setStage: ThumbSetStage,
  done: ThumbLoadDone
): void {
  const TARGET = Math.round(512 * (window.devicePixelRatio || 1))
  const video = document.createElement("video")
  video.crossOrigin = "anonymous"
  video.muted = true
  video.playsInline = true
  // metadata + seek: Safari range-requests one frame instead of the whole file.
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
    // Safari can fire seeked before the frame is decodable; wait for data.
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
        ;(ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality =
          "medium"
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        done(true, canvas)
      } else {
        done(false, null)
      }
    } catch {
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
  setTimeout(() => {
    if (!handled) handleVideoError()
  }, 8000)

  video.src = url
  video.load()
}

/**
 * Fetch/decode an image into a downscaled canvas.
 * Cache key is `url`; network fetch may use a Storage render URL.
 */
export function loadImageThumb(
  url: string,
  setStage: ThumbSetStage,
  done: ThumbLoadDone,
  debug = false
): void {
  const TARGET = Math.round(512 * (window.devicePixelRatio || 1))
  // Contain (not card/cover): keep the generated aspect so CSS can frame it.
  const fetchUrl = optimizeStorageImageUrl(url, {
    width: IMAGE_SIZE_PX.card,
    quality: IMAGE_SIZE_QUALITY.card,
    resize: "contain",
  })

  const processWithImageFallback = (src = fetchUrl) => {
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
          drawBitmapToTarget(bitmap, TARGET, done)
          bitmap.close()
          img.src = ""
          return
        } catch {
          // fall through to canvas draw
        }
      }

      drawBitmapToTarget(img, TARGET, done)
      img.src = ""
    }
    img.onerror = () => {
      if (src !== url) processWithImageFallback(url)
      else done(false, null)
    }
    try {
      img.src = src
    } catch {
      done(false, null)
    }
  }

  if (typeof window.fetch !== "function") {
    processWithImageFallback()
    return
  }

  setStage(url, "fetch")
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const abortTimer = controller ? setTimeout(() => controller.abort(), 10000) : null
  let httpStatusFailed = false

  fetch(fetchUrl, { mode: "cors", signal: controller?.signal })
    .then((res) => {
      if (!res.ok) {
        httpStatusFailed = true
        throw new Error(`HTTP ${res.status}`)
      }
      setStage(url, "blob")
      return res.blob()
    })
    .then((blob) => {
      if (abortTimer) clearTimeout(abortTimer)
      return bitmapFromBlob(blob, TARGET, setStage, url, done)
    })
    .catch((err) => {
      if (abortTimer) clearTimeout(abortTimer)
      if (debug) {
        console.warn(
          `[imprenta-thumb] fetch path failed (${err?.message ?? err?.name ?? err}): ${url.slice(-60)}`
        )
      }
      if (httpStatusFailed) {
        if (fetchUrl !== url) {
          fetch(url, { mode: "cors" })
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              return res.blob()
            })
            .then((blob) => bitmapFromBlob(blob, TARGET, setStage, url, done))
            .catch(() => processWithImageFallback(url))
          return
        }
        done(false, null)
        return
      }
      processWithImageFallback()
    })
}
