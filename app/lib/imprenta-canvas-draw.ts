"use client"

import type { ImprentaCanvasTheme } from "./imprenta-canvas-theme"
import type { DrawLiteNodeInputs } from "./imprenta-canvas-theme"
import { nodeHasResult } from "./imprenta-canvas-widgets"
import { liteNodeMarkerRect } from "./imprenta-canvas-theme"
import { fillAndStrokeRounded } from "./imprenta-canvas-primitives"
import { drawThumbOrSkeleton } from "./imprenta-canvas-widgets"
import { fillRounded } from "./imprenta-canvas-primitives"
import { isFullBleedMediaResult } from "./imprenta-canvas-widgets"
import { drawFullBleedMediaCover } from "./imprenta-canvas-widgets"
import { drawLine } from "./imprenta-canvas-primitives"
import { drawVideoGlyph } from "./imprenta-canvas-widgets"
import { fitText } from "./imprenta-canvas-primitives"
import { strokeRounded } from "./imprenta-canvas-primitives"
import { drawPublishRail } from "./imprenta-canvas-widgets"
import { drawResultBlock } from "./imprenta-canvas-widgets"
import { drawDestinationPills } from "./imprenta-canvas-widgets"
import { drawSegmentedControl } from "./imprenta-canvas-widgets"
import { segmentedActiveIndex } from "./imprenta-canvas-widgets"
import { drawChannelPills } from "./imprenta-canvas-widgets"
import { drawToolbarRow } from "./imprenta-canvas-widgets"
import { roundedRect } from "./imprenta-canvas-primitives"

/**
 * Draw the full lite shell for a node, aligned to the same footprint as the DOM
 * full card so pan/zoom and edges remain pixel-stable when crossing the
 * full-detail threshold.
 */
/** Ultra-cheap node shell used during active pan/zoom (1 fill + 1 stroke). */
export function drawTurboNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
  theme: ImprentaCanvasTheme
) {
  ctx.fillStyle = theme.cardBg
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = theme.cardBorder
  ctx.lineWidth = Math.max(0.5, 1.5 / scale)
  ctx.strokeRect(x, y, w, h)
}

export function drawLiteNode(ctx: CanvasRenderingContext2D, p: DrawLiteNodeInputs) {
  const { node, x, y, w, h, scale, band, theme, coverImageUrl, coverVideoUrl, extraImageUrls, thumbs, drawLabel } = p
  const type = (node.type as string | undefined) ?? "prompt"
  const cornerR = 22
  const hasResult = nodeHasResult(node)

  if (band === "turbo") {
    drawTurboNode(ctx, x, y, w, h, scale, theme)
    return
  }

  if (band === "marker") {
    const scratch = { x: 0, y: 0, w: 0, h: 0 }
    liteNodeMarkerRect(x, y, w, h, scale, scratch)
    
    // Line width clamped to ~2 screen pixels
    const lw = Math.max(0.5, 2 / scale)
    const r = Math.max(4, 8 / scale)
    
    fillAndStrokeRounded(ctx, scratch.x, scratch.y, scratch.w, scratch.h, r, theme.cardBg, theme.cardBorder, lw)
    
    const pad = 4 / scale
    const innerX = scratch.x + pad
    const innerY = scratch.y + pad
    const innerW = scratch.w - pad * 2
    const innerH = scratch.h - pad * 2
    
    if (coverImageUrl || coverVideoUrl) {
      drawThumbOrSkeleton(ctx, innerX, innerY, innerW, innerH, r - pad/2, theme, coverImageUrl || coverVideoUrl, thumbs)
      if (coverVideoUrl) {
        // A simple centered circle instead of the full video glyph, which is too complex
        ctx.fillStyle = theme.cardBg
        ctx.beginPath()
        ctx.arc(innerX + innerW / 2, innerY + innerH / 2, Math.min(innerW, innerH) * 0.25, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = theme.mutedFill
        ctx.lineWidth = lw
        ctx.stroke()
      }
    } else {
      const lineH = 6 / scale
      const lineGap = 4 / scale
      const lineW1 = innerW * 0.7
      const lineW2 = innerW * 0.5
      
      fillRounded(ctx, innerX + innerW * 0.15, innerY + innerH / 2 - lineH - lineGap / 2, lineW1, lineH, lineH / 2, theme.skeletonLine)
      fillRounded(ctx, innerX + innerW * 0.25, innerY + innerH / 2 + lineGap / 2, lineW2, lineH, lineH / 2, theme.skeletonLine)
    }
    return
  }

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
    if (isFullBleedMediaResult(hasResult, type, coverImageUrl, coverVideoUrl)) {
      drawFullBleedMediaCover(ctx, x, y, w, h, cornerR, theme, coverImageUrl, coverVideoUrl, thumbs)
      return
    }
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
      drawThumbOrSkeleton(ctx, ix, bodyTop, iw, bodyH, 12, theme, coverImageUrl || coverVideoUrl, thumbs)
      if (coverVideoUrl) {
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

  if (isFullBleedMediaResult(hasResult, type, coverImageUrl, coverVideoUrl)) {
    drawFullBleedMediaCover(ctx, x, y, w, h, cornerR, theme, coverImageUrl, coverVideoUrl, thumbs)
    return
  }

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
    const maxMediaH = Math.max(48, bodyBottom - cursorY - (type === "generate-audience" ? 38 : 0))
    const naturalH = innerW
    const mediaH = Math.min(maxMediaH, naturalH)
    drawThumbOrSkeleton(ctx, innerX, cursorY, innerW, mediaH, 18, theme, coverImageUrl || coverVideoUrl, thumbs)
    if (coverVideoUrl) {
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

export { imprentaCanvasTheme, bandFromScale, liteNodeMarkerRect } from "./imprenta-canvas-theme"
export type { ImprentaLiteBand, ImprentaCanvasTheme, DrawLiteNodeInputs } from "./imprenta-canvas-theme"
export { roundedRect } from "./imprenta-canvas-primitives"
