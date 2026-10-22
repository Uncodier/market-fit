import { InstanceNode } from "@/app/types/instance-nodes"
import { imprentaMediaBoxHeight, imprentaNodeMediaAspectCss } from "@/app/lib/imprenta-media-aspect"
import { isImprentaVisualMediaResultCard } from './result-helpers'

export const FALLBACK_POS = Object.freeze({ x: 100, y: 100 })

export const IMPRENTA_NODE_W = 480

export const IMPRENTA_ROW_H = 300

export const IMPRENTA_VIEWPORT_CULL_PAD = 96

export const IMPRENTA_VIEWPORT_UNMOUNT_PAD = 512

export const IMPRENTA_LOD_FULL_DETAIL_SCALE = 0.4

export const IMPRENTA_LOD_LITE_MARKER_MAX = 0.08

export const IMPRENTA_LOD_LITE_MICRO_MAX = 0.10

export const IMPRENTA_LOD_LITE_SIMPLE_MAX = 0.15

export type ImprentaLiteSkeletonBand = "marker" | "micro" | "simple" | "rich"

export type LoadingRouteEdge = { parentId: string; childId: string }

export function imprentaLiteSkeletonBand(scale: number): ImprentaLiteSkeletonBand {
  if (scale < IMPRENTA_LOD_LITE_MARKER_MAX) return "marker"
  if (scale < IMPRENTA_LOD_LITE_MICRO_MAX) return "micro"
  if (scale < IMPRENTA_LOD_LITE_SIMPLE_MAX) return "simple"
  return "rich"
}

export function imprentaExtractResultUrl(text: unknown): string {
  if (!text) return ""
  const str = String(text)
  const urlMatch = str.match(/https?:\/\/[^\s"'<>()]+/)
  return urlMatch ? urlMatch[0] : str
}

export function collectImprentaLiteImagePreviewUrls(node: InstanceNode, max = 4): string[] {
  const urls: string[] = []
  const push = (raw: unknown) => {
    const u = imprentaExtractResultUrl(raw)
    if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u)
  }
  const res = node.result as Record<string, unknown> | undefined
  if (!res) return urls

  const outputs = res.outputs as unknown[] | undefined
  if (Array.isArray(outputs)) {
    for (const o of outputs) {
      if (!o || typeof o !== "object") continue
      const item = o as Record<string, unknown>
      if (item.type === "image") {
        if (item.url) push(item.url)
        const data = item.data as Record<string, unknown> | undefined
        if (data?.url) push(data.url)
      }
      if (item.type === "video") {
        if (item.thumbnail_url) push(item.thumbnail_url)
        if (item.cover_url) push(item.cover_url)
        if (item.poster_url) push(item.poster_url)
        if (item.poster) push(item.poster)
        const data = item.data as Record<string, unknown> | undefined
        if (data?.thumbnail_url) push(data.thumbnail_url)
        if (data?.cover_url) push(data.cover_url)
        if (data?.poster_url) push(data.poster_url)
        if (data?.poster) push(data.poster)
      }
    }
  }
  if (urls.length < max) {
    const media = res.media as unknown[] | undefined
    if (Array.isArray(media)) {
      for (const m of media) {
        if (!m || typeof m !== "object") continue
        const item = m as Record<string, unknown>
        if (item.type === "image" && item.url) push(item.url)
        if (item.type === "video") {
          if (item.thumbnail_url) push(item.thumbnail_url)
          if (item.cover_url) push(item.cover_url)
          if (item.poster_url) push(item.poster_url)
          if (item.poster) push(item.poster)
        }
      }
    }
  }
  if (urls.length < max) {
    const images = res.images as unknown[] | undefined
    if (Array.isArray(images)) {
      for (const img of images) {
        if (img && typeof img === "object" && "url" in img) push((img as { url: unknown }).url)
      }
    }
  }
  if (urls.length < max) {
    const image = res.image as { url?: unknown } | undefined
    if (image?.url) push(image.url)
  }
  if (urls.length < max) {
    const video = res.video as { url?: unknown, thumbnail_url?: unknown, cover_url?: unknown, poster_url?: unknown, poster?: unknown } | undefined
    if (video?.thumbnail_url) push(video.thumbnail_url)
    if (video?.cover_url) push(video.cover_url)
    if (video?.poster_url) push(video.poster_url)
    if (video?.poster) push(video.poster)
  }
  return urls.slice(0, max)
}

export function collectImprentaLiteVideoPreviewUrls(node: InstanceNode, max = 2): string[] {
  const urls: string[] = []
  const push = (raw: unknown) => {
    const u = imprentaExtractResultUrl(raw)
    if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u)
  }
  const res = node.result as Record<string, unknown> | undefined
  if (!res) return urls

  const outputs = res.outputs as unknown[] | undefined
  if (Array.isArray(outputs)) {
    for (const o of outputs) {
      if (!o || typeof o !== "object") continue
      const item = o as Record<string, unknown>
      if (item.type === "video") {
        if (item.url) push(item.url)
        const data = item.data as Record<string, unknown> | undefined
        if (data?.url) push(data.url)
      }
    }
  }
  if (urls.length < max) {
    const media = res.media as unknown[] | undefined
    if (Array.isArray(media)) {
      for (const m of media) {
        if (!m || typeof m !== "object") continue
        const item = m as Record<string, unknown>
        if (item.type === "video" && item.url) push(item.url)
      }
    }
  }
  if (urls.length < max) {
    const video = res.video as { url?: unknown } | undefined
    if (video?.url) push(video.url)
  }
  return urls.slice(0, max)
}

export const IMPRENTA_CARD_CONTENT_W = 440

export function estimateImprentaNodeContentHeight(node: InstanceNode, rowH: number): number {
  if (isImprentaVisualMediaResultCard(node, [])) {
    return Math.min(
      Math.max(imprentaMediaBoxHeight(IMPRENTA_NODE_W, imprentaNodeMediaAspectCss(node)), 120),
      1600
    )
  }

  let extra = 0
  const promptText =
    typeof (node.prompt as { text?: string } | undefined)?.text === "string"
      ? (node.prompt as { text: string }).text
      : ""
  const promptLines = Math.min(28, Math.max(0, Math.ceil(promptText.length / 70)))
  extra += promptLines * 20
  const mediaH = imprentaMediaBoxHeight(
    IMPRENTA_CARD_CONTENT_W,
    imprentaNodeMediaAspectCss(node)
  )

  const res = node.result as Record<string, unknown> | undefined
  if (!res || Object.keys(res).length === 0) {
    return Math.min(Math.max(rowH + extra + 32, rowH), 960)
  }

  extra += 48
  const outputs = res.outputs as unknown[] | undefined
  const media = res.media as unknown[] | undefined
  const images = res.images as unknown[] | undefined
  const image = res.image as { url?: string } | undefined
  const video = res.video as { url?: string } | undefined
  const audio = res.audio as { url?: string } | undefined
  const text = res.text as string | undefined

  if (Array.isArray(outputs) && outputs.length > 0) {
    extra += mediaH
  } else if (Array.isArray(media) && media.length > 0) {
    extra += mediaH
  } else if (Array.isArray(images) && images.length > 0) {
    extra += mediaH
  } else if (image?.url) {
    extra += mediaH
  } else if (video?.url) {
    extra += mediaH
  } else if (audio?.url) {
    extra += 140
  } else if (typeof text === "string" && text.length > 0) {
    const tl = Math.min(48, Math.ceil(text.length / 62))
    extra += tl * 22 + 48
    if (/https?:\/\/[^\s"'<>()]+\.(jpg|jpeg|png|gif|webp|svg)/i.test(text) || /!\[.*?\]\(https?:\/\/[^\s"'<>()]+\)/i.test(text)) {
      extra += mediaH
    }
  } else if (res.audience_leads != null || res.example_leads != null) {
    extra += 220
  } else {
    extra += 100
  }

  return Math.min(Math.max(rowH + extra, rowH + 64), 1600)
}
