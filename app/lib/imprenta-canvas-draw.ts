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
 * No React dependencies; safe to call from any animation frame.
 */

export type ImprentaLiteBand = "micro" | "simple" | "rich"

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
      cardBg: "#181818",
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
  microMax: number,
  simpleMax: number
): ImprentaLiteBand {
  if (scale < microMax) return "micro"
  if (scale < simpleMax) return "simple"
  return "rich"
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function fillRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function strokeRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lineWidth: number
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

/**
 * Trace the path once and both fill & stroke it. Saves one full path tracing
 * (4 arcs + 4 lines) per node vs. calling fillRounded + strokeRounded. Adds up
 * on the micro band where hundreds of nodes are drawn every frame.
 */
function fillAndStrokeRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
  lineWidth: number
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
) {
  fillRounded(ctx, x, y, w, h, h / 2, fill)
}

function clipRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.clip()
}

function drawThumbOrSkeleton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  theme: ImprentaCanvasTheme,
  url: string | null,
  thumbs: ImprentaThumbCache | null
) {
  if (url && thumbs) {
    const img = thumbs.get(url)
    if (img) {
      ctx.save()
      clipRounded(ctx, x, y, w, h, r)
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
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
      strokeRounded(ctx, x, y, w, h, r, theme.skeletonBlockBorder, 1)
      return
    }
    thumbs.request(url)
  }
  fillAndStrokeRounded(ctx, x, y, w, h, r, theme.skeletonMedia, theme.skeletonBlockBorder, 1)
}

/** Full-width segmented control with 6 equal-width pills (mirrors the media-type selector). */
function drawSegmentedControl(
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
function drawToolbarRow(
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

function drawVideoGlyph(
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
  ctx.moveTo(cx - 5, cy - 8)
  ctx.lineTo(cx + 9, cy)
  ctx.lineTo(cx - 5, cy + 8)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPublishRail(
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

function drawDestinationPills(
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

function drawChannelPills(
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

function nodeHasResult(node: InstanceNode): boolean {
  const r = node.result as Record<string, unknown> | undefined
  return !!r && typeof r === "object" && Object.keys(r).length > 0
}

function segmentedActiveIndex(type: string): number {
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

export interface DrawLiteNodeInputs {
  node: InstanceNode
  x: number
  y: number
  w: number
  h: number
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

/**
 * Draw the full lite shell for a node, aligned to the same footprint as the DOM
 * full card so pan/zoom and edges remain pixel-stable when crossing the
 * full-detail threshold.
 */
export function drawLiteNode(ctx: CanvasRenderingContext2D, p: DrawLiteNodeInputs) {
  const { node, x, y, w, h, band, theme, coverImageUrl, coverVideoUrl, extraImageUrls, thumbs, drawLabel } = p
  const type = (node.type as string | undefined) ?? "prompt"
  const cornerR = 22
  const hasResult = nodeHasResult(node)

  // Card background + 2px border (matches final card: border-2 border-foreground/10).
  // Single path, two rasterizations → saves ~100 arcs per frame on busy viewports.
  fillAndStrokeRounded(ctx, x, y, w, h, cornerR, theme.cardBg, theme.cardBorder, 2)

  // Fast path: at the farthest ("micro") zoom nodes are only a few CSS pixels
  // tall on screen. We still draw the three-zone silhouette — label strip,
  // content block, bottom button — so the card reads as a card, not an empty
  // white box. When the node has a cover image/video we paint it inside the
  // body area so content stays readable at every zoom (no "it'll load any
  // second now" illusion).
  if (band === "micro") {
    const ix = x + 18
    const iw = w - 36
    drawLine(ctx, ix, y + 18, 56, 6, theme.skeletonLine)
    if (hasResult) {
      drawLine(ctx, x + w - 18 - 36, y + 18, 36, 6, theme.skeletonLine)
    }
    const bodyTop = y + 34
    const bodyBottom = y + h - 44
    const bodyH = Math.max(20, bodyBottom - bodyTop)
    if (coverImageUrl || coverVideoUrl) {
      drawThumbOrSkeleton(ctx, ix, bodyTop, iw, bodyH, 12, theme, coverImageUrl, thumbs)
      if (!coverImageUrl && coverVideoUrl) {
        drawVideoGlyph(ctx, ix + iw / 2, bodyTop + bodyH / 2, theme)
      }
    } else {
      fillAndStrokeRounded(ctx, ix, bodyTop, iw, bodyH, 12, theme.skeletonBlock, theme.skeletonBlockBorder, 1)
    }
    ctx.fillStyle = theme.separator
    ctx.fillRect(ix, y + h - 34, iw, 1)
    const btnY = y + h - 28
    if (hasResult) {
      const gap = 4
      const bw = (iw - gap * 3) / 4
      for (let i = 0; i < 4; i++) {
        fillAndStrokeRounded(
          ctx,
          ix + i * (bw + gap),
          btnY,
          bw,
          20,
          5,
          theme.skeletonBlock,
          theme.skeletonBlockBorder,
          1
        )
      }
    } else {
      fillAndStrokeRounded(ctx, ix, btnY, iw, 20, 5, theme.skeletonBlock, theme.skeletonBlockBorder, 1)
    }
    return
  }

  const rich = band === "rich"

  // --- Content layout --------------------------------------------------------
  //
  // p-5 (20px) padding mirrors CardContent's final layout. The card is split
  // into three flex zones: label row (fixed), body (stretch), footer (fixed).
  const padding = 20
  const innerX = x + padding
  const innerW = w - padding * 2

  // 1) Label row (TYPE or RESULT) + optional status badge
  const labelY = y + padding
  const labelH = 14
  if (drawLabel) {
    const label = hasResult ? "RESULT" : (type || "node").replace(/-/g, " ").toUpperCase()
    ctx.save()
    ctx.fillStyle = theme.labelFill
    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    ctx.textBaseline = "middle"
    const maxLabelW = innerW - 80
    ctx.fillText(fitText(ctx, label, maxLabelW), innerX, labelY + labelH / 2)
    ctx.restore()
  } else {
    drawLine(ctx, innerX, labelY + labelH / 2 - 3, 56, 6, theme.mutedFill)
  }
  if (hasResult) {
    const badgeW = 52
    fillRounded(ctx, x + w - padding - badgeW, labelY, badgeW, labelH, 4, theme.badgeBg)
    strokeRounded(ctx, x + w - padding - badgeW, labelY, badgeW, labelH, 4, theme.badgeBorder, 1)
  }

  // 3) Footer: separator + full-width Generate button (no result) OR
  //    four equal action buttons (Variant · Action · Copy · Download).
  const btnH = 32
  const footerGap = 12
  const footerTop = y + h - padding - btnH
  const sepY = footerTop - footerGap
  ctx.fillStyle = theme.separator
  ctx.fillRect(innerX, sepY, innerW, 1)
  if (hasResult) {
    const gap = 6
    const bw = (innerW - gap * 3) / 4
    for (let i = 0; i < 4; i++) {
      const bx = innerX + i * (bw + gap)
      fillRounded(ctx, bx, footerTop, bw, btnH, 8, theme.skeletonBlock)
      strokeRounded(ctx, bx, footerTop, bw, btnH, 8, theme.skeletonBlockBorder, 1)
      drawLine(ctx, bx + bw * 0.25, footerTop + btnH / 2 - 3, bw * 0.5, 6, theme.skeletonLine)
    }
  } else {
    fillRounded(ctx, innerX, footerTop, innerW, btnH, 8, theme.skeletonBlock)
    strokeRounded(ctx, innerX, footerTop, innerW, btnH, 8, theme.skeletonBlockBorder, 1)
    drawLine(
      ctx,
      innerX + innerW / 2 - 36,
      footerTop + btnH / 2 - 3,
      72,
      6,
      theme.skeletonLine
    )
  }

  // 2) Body zone between label row and separator.
  const bodyTop = labelY + labelH + 12
  const bodyBottom = sepY - 12

  // --- Publish: left rail + destinations + textarea ---
  if (type === "publish") {
    drawPublishRail(ctx, innerX - 6, bodyTop, bodyBottom, rich, theme)
    const contentX = innerX + 24
    const contentW = innerW - 24
    if (hasResult) {
      drawResultBlock(
        ctx,
        contentX,
        bodyTop,
        contentW,
        bodyBottom - bodyTop,
        theme,
        coverImageUrl,
        coverVideoUrl,
        thumbs,
        rich
      )
    } else {
      drawDestinationPills(ctx, contentX, bodyTop, contentW, theme, rich)
      const destH = rich ? 72 : 36
      const taY = bodyTop + destH
      const taH = Math.max(32, bodyBottom - taY)
      fillRounded(ctx, contentX, taY, contentW, taH, 12, theme.skeletonBlock)
      strokeRounded(ctx, contentX, taY, contentW, taH, 12, theme.skeletonBlockBorder, 1)
      const pad = 10
      drawLine(ctx, contentX + pad, taY + pad, contentW * 0.62, 5, theme.skeletonLine)
      if (rich) drawLine(ctx, contentX + pad, taY + pad + 10, contentW * 0.42, 5, theme.skeletonLine)
    }
    return
  }

  // --- Result state: show media cover or text block ---
  if (hasResult) {
    drawResultBlock(
      ctx,
      innerX,
      bodyTop,
      innerW,
      bodyBottom - bodyTop,
      theme,
      coverImageUrl,
      coverVideoUrl,
      thumbs,
      rich
    )
    if (rich && extraImageUrls.length > 0) {
      // nothing — extra thumbs are drawn inside drawResultBlock when space allows.
    }
    return
  }

  // --- Non-result prompt / generate-* / generate-audience ---
  let cursorY = bodyTop
  // Segmented media-type control (skipped for audience; it keeps its channel pills lower down).
  drawSegmentedControl(ctx, innerX, cursorY, innerW, theme, segmentedActiveIndex(type))
  cursorY += 32 + 10

  // Textarea / media placeholder fills most of the remaining body.
  const showMedia =
    type === "generate-image" ||
    type === "generate-video" ||
    !!coverImageUrl ||
    !!coverVideoUrl
  if (showMedia) {
    const videoLayout = type === "generate-video" || (!coverImageUrl && !!coverVideoUrl)
    const maxMediaH = Math.max(48, bodyBottom - cursorY - (type === "generate-audience" ? 38 : 0))
    const naturalH = videoLayout ? innerW * (9 / 16) : innerW * 0.8
    const mediaH = Math.min(maxMediaH, naturalH)
    drawThumbOrSkeleton(ctx, innerX, cursorY, innerW, mediaH, 18, theme, coverImageUrl, thumbs)
    if (!coverImageUrl && coverVideoUrl) {
      drawVideoGlyph(ctx, innerX + innerW / 2, cursorY + mediaH / 2, theme)
    }
    cursorY += mediaH + 8
  } else {
    const taH = Math.max(48, bodyBottom - cursorY - (type === "generate-audience" ? 38 : 10))
    fillRounded(ctx, innerX, cursorY, innerW, taH, 12, theme.skeletonBlock)
    strokeRounded(ctx, innerX, cursorY, innerW, taH, 12, theme.skeletonBlockBorder, 1)
    const pad = 10
    drawLine(ctx, innerX + pad, cursorY + pad, innerW * 0.72, 5, theme.skeletonLine)
    if (rich) {
      drawLine(ctx, innerX + pad, cursorY + pad + 10, innerW * 0.58, 5, theme.skeletonLine)
      drawLine(ctx, innerX + pad, cursorY + pad + 20, innerW * 0.42, 5, theme.skeletonLine)
    }
    cursorY += taH + 8
  }

  // generate-audience: channel pills row below textarea.
  if (type === "generate-audience") {
    drawChannelPills(ctx, innerX, Math.min(cursorY, bodyBottom - 32), theme)
    return
  }

  // Toolbar row (MediaParametersToolbar placeholder) if there's room.
  if (cursorY + 24 <= bodyBottom) {
    drawToolbarRow(ctx, innerX, cursorY, innerW, theme, rich)
  }
}

function drawResultBlock(
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
    const videoLayout = !coverImageUrl && !!coverVideoUrl
    const naturalH = videoLayout ? w * (9 / 16) : w * 0.8
    const mediaH = Math.min(h, Math.max(48, naturalH))
    drawThumbOrSkeleton(ctx, x, y, w, mediaH, 14, theme, coverImageUrl, thumbs)
    if (!coverImageUrl && coverVideoUrl) {
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

/**
 * Draw a selection ring around a lite shell (for visual feedback when a node is
 * selected even though the full DOM card is not mounted).
 */
export function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  roundedRect(ctx, x - 2, y - 2, w + 4, h + 4, 24)
  ctx.stroke()
  ctx.restore()
}

// (font, text) → width, to dodge Safari's expensive measureText on the hot draw path.
const measureCache = new Map<string, number>()
const MEASURE_CACHE_MAX = 2048

function measureCached(ctx: CanvasRenderingContext2D, text: string): number {
  const key = `${ctx.font}\u0001${text}`
  const cached = measureCache.get(key)
  if (cached !== undefined) return cached
  const w = ctx.measureText(text).width
  if (measureCache.size >= MEASURE_CACHE_MAX) {
    // Cheap FIFO eviction: clear oldest ~¼ of the cache on overflow.
    let i = 0
    for (const k of measureCache.keys()) {
      measureCache.delete(k)
      if (++i >= MEASURE_CACHE_MAX / 4) break
    }
  }
  measureCache.set(key, w)
  return w
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (measureCached(ctx, text) <= maxW) return text
  let out = text
  while (out.length > 1 && measureCached(ctx, out + "…") > maxW) {
    out = out.slice(0, -1)
  }
  return out + "…"
}
