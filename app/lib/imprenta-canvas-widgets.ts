"use client"

import type { ImprentaCanvasTheme } from "./imprenta-canvas-theme"
import type { ImprentaThumbCache } from "./imprenta-thumb-cache"
import { clipRounded } from "./imprenta-canvas-primitives"
import { fillRounded } from "./imprenta-canvas-primitives"
import { strokeRounded } from "./imprenta-canvas-primitives"
import { fillAndStrokeRounded } from "./imprenta-canvas-primitives"
import { drawLine } from "./imprenta-canvas-primitives"
import type { InstanceNode } from "@/app/types/instance-nodes"

export function drawThumbOrSkeleton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  theme: ImprentaCanvasTheme,
  url: string | null,
  thumbs: ImprentaThumbCache | null,
  stroke = true
) {
  if (url && thumbs) {
    const img = thumbs.get(url)
    if (img) {
      ctx.save()
      clipRounded(ctx, x, y, w, h, r)
      const iw = img.width
      const ih = img.height
      if (iw > 0 && ih > 0) {
        const scale = Math.max(w / iw, h / ih)
        const dw = iw * scale
        const dh = ih * scale
        const dx = x + (w - dw) / 2
        const dy = y + (h - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)
      } else {
        fillRounded(ctx, x, y, w, h, r, theme.skeletonMedia)
      }
      ctx.restore()
      if (stroke) strokeRounded(ctx, x, y, w, h, r, theme.skeletonBlockBorder, 1)
      return
    }
    // Viewport covers only reach this path while being painted — prioritize them
    // ahead of background FIFO so lite shells do not stay grey behind full cards.
    thumbs.requestPriority(url)
  }
  if (stroke) {
    fillAndStrokeRounded(ctx, x, y, w, h, r, theme.skeletonMedia, theme.skeletonBlockBorder, 1)
  } else {
    fillRounded(ctx, x, y, w, h, r, theme.skeletonMedia)
  }
}

/** Full-width segmented control with 6 equal-width pills (mirrors the media-type selector). */
export function drawSegmentedControl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  theme: ImprentaCanvasTheme,
  activeIndex: number
) {
  const h = 32
  const pad = 4
  fillRounded(ctx, x, y, w, h, 14, theme.segmentBg)
  strokeRounded(ctx, x, y, w, h, 14, theme.segmentBorder, 1)
  const count = 6
  const gap = 2
  const innerW = w - pad * 2
  const pillW = (innerW - gap * (count - 1)) / count
  for (let i = 0; i < count; i++) {
    const px = x + pad + i * (pillW + gap)
    const py = y + pad
    const ph = h - pad * 2
    const isActive = i === activeIndex
    fillRounded(
      ctx,
      px,
      py,
      pillW,
      ph,
      ph / 2,
      isActive ? theme.segmentPill : "transparent"
    )
    if (isActive) {
      strokeRounded(ctx, px, py, pillW, ph, ph / 2, theme.segmentPillBorder, 1)
    }
    const labelW = Math.max(16, pillW * 0.55)
    const labelH = 6
    drawLine(
      ctx,
      px + (pillW - labelW) / 2,
      py + (ph - labelH) / 2,
      labelW,
      labelH,
      isActive ? theme.labelFill : theme.mutedFill
    )
  }
}

/** Row of 2–3 mid-sized pills, resembling the MediaParametersToolbar. */
export function drawToolbarRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  theme: ImprentaCanvasTheme,
  rich: boolean
) {
  const h = 24
  const gap = 8
  const widths = rich ? [56, 56, 72, 44] : [48, 64]
  let cx = x
  for (const pw of widths) {
    if (cx + pw > x + w) break
    fillRounded(ctx, cx, y, pw, h, 10, theme.skeletonBlock)
    strokeRounded(ctx, cx, y, pw, h, 10, theme.skeletonBlockBorder, 1)
    cx += pw + gap
  }
}

export function drawVideoGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  theme: ImprentaCanvasTheme
) {
  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = theme.cardBg
  ctx.beginPath()
  ctx.arc(cx, cy, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = theme.mutedFill
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = theme.mutedFill
  ctx.beginPath()
  ctx.moveTo(cx - 3, cy - 8)
  ctx.lineTo(cx + 11, cy)
  ctx.lineTo(cx - 3, cy + 8)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawPublishRail(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  bottomY: number,
  rich: boolean,
  theme: ImprentaCanvasTheme
) {
  const cx = x + 2
  const r = 7
  const ys = rich
    ? [topY + 8, (topY + bottomY) / 2, bottomY - 8]
    : [topY + 8, bottomY - 8]
  for (let i = 0; i < ys.length; i++) {
    ctx.beginPath()
    ctx.arc(cx + r, ys[i], r, 0, Math.PI * 2)
    ctx.fillStyle = theme.cardBg
    ctx.fill()
    ctx.strokeStyle = i === 0 ? theme.primary : theme.mutedFill
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

export function drawDestinationPills(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  theme: ImprentaCanvasTheme,
  rich: boolean
) {
  const h = 28
  const gap = 6
  const widths = rich ? [72, 72, 64, 88, 80] : [72, 72, 64]
  let cx = x
  let cy = y
  for (const pw of widths) {
    if (cx + pw > x + w) {
      cx = x
      cy += h + gap
    }
    fillRounded(ctx, cx, cy, pw, h, h / 2, theme.skeletonBlock)
    strokeRounded(ctx, cx, cy, pw, h, h / 2, theme.skeletonBlockBorder, 1)
    cx += pw + gap
  }
}

export function drawChannelPills(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  theme: ImprentaCanvasTheme
) {
  const h = 30
  const gap = 8
  const widths = [64, 64, 68]
  let cx = x
  for (const pw of widths) {
    fillRounded(ctx, cx, y, pw, h, 12, theme.skeletonBlock)
    strokeRounded(ctx, cx, y, pw, h, 12, theme.skeletonBlockBorder, 1)
    cx += pw + gap
  }
}

export function nodeHasResult(node: InstanceNode): boolean {
  const r = node.result as Record<string, unknown> | undefined
  return !!r && typeof r === "object" && Object.keys(r).length > 0
}

export function isFullBleedMediaResult(
  hasResult: boolean,
  type: string,
  coverImageUrl: string | null,
  coverVideoUrl: string | null
) {
  return hasResult && type !== "publish" && !!(coverImageUrl || coverVideoUrl)
}

export function drawFullBleedMediaCover(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cornerR: number,
  theme: ImprentaCanvasTheme,
  coverImageUrl: string | null,
  coverVideoUrl: string | null,
  thumbs: ImprentaThumbCache | null
) {
  const inset = 2
  const ix = x + inset
  const iy = y + inset
  const iw = Math.max(1, w - inset * 2)
  const ih = Math.max(1, h - inset * 2)
  const ir = Math.max(4, cornerR - inset)
  drawThumbOrSkeleton(ctx, ix, iy, iw, ih, ir, theme, coverImageUrl || coverVideoUrl, thumbs, false)
  if (coverVideoUrl) {
    drawVideoGlyph(ctx, ix + iw / 2, iy + ih / 2, theme)
  }
}

export function segmentedActiveIndex(type: string): number {
  switch (type) {
    case "generate-image":
      return 1
    case "generate-video":
      return 2
    case "generate-audio":
      return 3
    case "generate-audience":
      return 4
    case "publish":
      return 5
    case "prompt":
    default:
      return 0
  }
}

export function drawResultBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: ImprentaCanvasTheme,
  coverImageUrl: string | null,
  coverVideoUrl: string | null,
  thumbs: ImprentaThumbCache | null,
  rich: boolean
) {
  if (coverImageUrl || coverVideoUrl) {
    const mediaH = Math.min(h, Math.max(48, w))
    drawThumbOrSkeleton(ctx, x, y, w, mediaH, 14, theme, coverImageUrl || coverVideoUrl, thumbs)
    if (coverVideoUrl) {
      drawVideoGlyph(ctx, x + w / 2, y + mediaH / 2, theme)
    }
    return
  }
  // Text result placeholder (matches the accent-tinted text container).
  fillRounded(ctx, x, y, w, h, 12, theme.skeletonBlock)
  strokeRounded(ctx, x, y, w, h, 12, theme.skeletonBlockBorder, 1)
  const pad = 12
  const lines = rich ? 5 : 3
  const widths = [0.92, 0.85, 0.78, 0.88, 0.64]
  for (let i = 0; i < lines; i++) {
    const lineY = y + pad + i * 12
    if (lineY + 6 > y + h - pad) break
    drawLine(ctx, x + pad, lineY, (w - pad * 2) * widths[i % widths.length], 5, theme.skeletonLine)
  }
}
