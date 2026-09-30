"use client"

import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaThumbCache } from "./imprenta-thumb-cache"

/**
 * Pure 2D canvas drawing helpers for lite Imprenta nodes.
 *
 * The rendered shell mirrors the layout of the full DOM card so pan/zoom
 * transitions are pixel-stable:
 *
 *   [ label + optional badge ]
 *   [ 6-pill media-type segmented control | destination buttons | empty ]
 *   [ media cover  /  textarea placeholder  /  result text block ]
 *   [ small toolbar row                                          ]
 *   ------------------------- separator -------------------------
 *   [ Generate button full width  |  Variant · Action · Copy · Download ]
 *
 * Image/video RESULT cards are an exception: the cover fills the card edge-to-edge
 * (action buttons live on the DOM card as a hover overlay).
 *
 * No React dependencies; safe to call from any animation frame.
 */

export type ImprentaLiteBand = "marker" | "micro" | "simple" | "rich" | "turbo"

export interface ImprentaCanvasTheme {
  cardBg: string
  cardBorder: string
  cardRing: string
  labelFill: string
  badgeBg: string
  badgeBorder: string
  skeletonBlock: string
  skeletonBlockBorder: string
  skeletonLine: string
  segmentBg: string
  segmentBorder: string
  segmentPill: string
  segmentPillBorder: string
  skeletonMedia: string
  mutedFill: string
  separator: string
  dashedBorder: string
  primary: string
}

export function imprentaCanvasTheme(isDark: boolean): ImprentaCanvasTheme {
  if (isDark) {
    return {
      cardBg: "#020817",
      cardBorder: "rgba(255,255,255,0.14)",
      cardRing: "rgba(255,255,255,0.08)",
      labelFill: "rgba(255,255,255,0.55)",
      badgeBg: "rgba(255,255,255,0.10)",
      badgeBorder: "rgba(255,255,255,0.14)",
      skeletonBlock: "rgba(255,255,255,0.06)",
      skeletonBlockBorder: "rgba(255,255,255,0.10)",
      skeletonLine: "rgba(255,255,255,0.30)",
      segmentBg: "rgba(255,255,255,0.05)",
      segmentBorder: "rgba(255,255,255,0.08)",
      segmentPill: "rgba(255,255,255,0.10)",
      segmentPillBorder: "rgba(255,255,255,0.14)",
      skeletonMedia: "rgba(255,255,255,0.07)",
      mutedFill: "rgba(255,255,255,0.40)",
      separator: "rgba(255,255,255,0.08)",
      dashedBorder: "rgba(255,255,255,0.14)",
      primary: "hsl(222, 84%, 60%)",
    }
  }
  return {
    cardBg: "#ffffff",
    cardBorder: "rgba(0,0,0,0.10)",
    cardRing: "rgba(0,0,0,0.08)",
    labelFill: "rgba(0,0,0,0.45)",
    badgeBg: "rgba(0,0,0,0.05)",
    badgeBorder: "rgba(0,0,0,0.10)",
    skeletonBlock: "rgba(0,0,0,0.05)",
    skeletonBlockBorder: "rgba(0,0,0,0.08)",
    skeletonLine: "rgba(0,0,0,0.22)",
    segmentBg: "rgba(0,0,0,0.04)",
    segmentBorder: "rgba(0,0,0,0.07)",
    segmentPill: "rgba(255,255,255,1)",
    segmentPillBorder: "rgba(0,0,0,0.08)",
    skeletonMedia: "rgba(0,0,0,0.05)",
    mutedFill: "rgba(0,0,0,0.42)",
    separator: "rgba(0,0,0,0.06)",
    dashedBorder: "rgba(0,0,0,0.14)",
    primary: "hsl(222, 84%, 52%)",
  }
}

export function bandFromScale(
  scale: number,
  markerMax: number,
  microMax: number,
  simpleMax: number
): ImprentaLiteBand {
  if (scale < markerMax) return "marker"
  if (scale < microMax) return "micro"
  if (scale < simpleMax) return "simple"
  return "rich"
}

export function liteNodeMarkerRect(
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
  out: { x: number; y: number; w: number; h: number }
) {
  const minScreenW = 44
  const minScreenH = 32
  
  const minWorldW = minScreenW / scale
  const minWorldH = minScreenH / scale
  
  const effectiveW = Math.max(w, minWorldW)
  const effectiveH = Math.max(h, minWorldH)
  
  const cx = x + w / 2
  const cy = y + h / 2
  
  out.x = cx - effectiveW / 2
  out.y = cy - effectiveH / 2
  out.w = effectiveW
  out.h = effectiveH
  return out
}

export interface DrawLiteNodeInputs {
  node: InstanceNode
  x: number
  y: number
  w: number
  h: number
  scale: number
  band: ImprentaLiteBand
  theme: ImprentaCanvasTheme
  /** First image/video URL to paint as cover / thumbnail; null when none. */
  coverImageUrl: string | null
  coverVideoUrl: string | null
  /** Additional thumbnail URLs for "rich" band layouts. */
  extraImageUrls: string[]
  thumbs: ImprentaThumbCache | null
  /** Draw label text; caller may skip text entirely at very low zoom to save memory. */
  drawLabel: boolean
}
