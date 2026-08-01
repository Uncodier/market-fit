export type AccessPassKind = "ticket" | "pass"

export type AccessPassTheme = {
  /** Card outer gradient (top → bottom) */
  outerFrom: string
  outerTo: string
  /** Header band */
  headerFrom: string
  headerTo: string
  accent: string
  accentSoft: string
  ink: string
  muted: string
  paper: string
  badgeBg: string
  badgeText: string
}

const THEMES: Record<AccessPassKind, AccessPassTheme> = {
  ticket: {
    outerFrom: "#0c1222",
    outerTo: "#1a2338",
    headerFrom: "#f59e0b",
    headerTo: "#ea580c",
    accent: "#f59e0b",
    accentSoft: "rgba(245, 158, 11, 0.18)",
    ink: "#0f172a",
    muted: "#64748b",
    paper: "#fffaf3",
    badgeBg: "rgba(15, 23, 42, 0.9)",
    badgeText: "#fde68a",
  },
  pass: {
    outerFrom: "#06251f",
    outerTo: "#0b3d36",
    headerFrom: "#14b8a6",
    headerTo: "#0d9488",
    accent: "#2dd4bf",
    accentSoft: "rgba(45, 212, 191, 0.16)",
    ink: "#042f2e",
    muted: "#5b7c78",
    paper: "#f4fbfa",
    badgeBg: "rgba(4, 47, 46, 0.92)",
    badgeText: "#99f6e4",
  },
}

export type DownloadAccessPassOptions = {
  qrSvg: SVGSVGElement
  title: string
  brandName?: string
  kind?: AccessPassKind
  dateLabel?: string
  timeLabel?: string
  venueLabel?: string
  codeLabel?: string
  footnote?: string
  filename?: string
}

/**
 * Renders a premium digital pass/ticket PNG and triggers download.
 * Not Apple/Google Wallet — a saveable visual card for offline check-in.
 */
export async function downloadAccessPass(options: DownloadAccessPassOptions): Promise<void> {
  const {
    qrSvg,
    title,
    brandName = "Market Fit",
    kind = "pass",
    dateLabel,
    timeLabel,
    venueLabel,
    codeLabel,
    footnote = "Present this QR at the entrance",
    filename = `${kind}.png`,
  } = options

  const theme = THEMES[kind]
  const width = 780
  const height = 1240
  const cardX = 48
  const cardY = 56
  const cardW = width - cardX * 2
  const cardH = height - cardY * 2
  const radius = 36

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not available")

  // Atmospheric background
  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, theme.outerFrom)
  bg.addColorStop(1, theme.outerTo)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Soft light orbs
  drawOrb(ctx, width * 0.15, height * 0.12, 220, theme.accent, 0.14)
  drawOrb(ctx, width * 0.85, height * 0.78, 280, theme.accent, 0.1)

  // Card shadow
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 18
  roundRect(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.fillStyle = theme.paper
  ctx.fill()
  ctx.restore()

  // Clip card content
  ctx.save()
  roundRect(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.clip()

  // Header band
  const headerH = 210
  const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH)
  headerGrad.addColorStop(0, theme.headerFrom)
  headerGrad.addColorStop(1, theme.headerTo)
  ctx.fillStyle = headerGrad
  ctx.fillRect(cardX, cardY, cardW, headerH)

  // Header texture stripes
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 2
  for (let i = -headerH; i < cardW + headerH; i += 28) {
    ctx.beginPath()
    ctx.moveTo(cardX + i, cardY)
    ctx.lineTo(cardX + i + headerH, cardY + headerH)
    ctx.stroke()
  }
  ctx.restore()

  // Brand + badge
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.font = "700 22px ui-sans-serif, system-ui, -apple-system, sans-serif"
  ctx.fillText(truncate(ctx, brandName.toUpperCase(), cardW - 220), cardX + 40, cardY + 52)

  const badge = kind === "ticket" ? "TICKET" : "PASS"
  const badgeW = 110
  const badgeH = 34
  const badgeX = cardX + cardW - 40 - badgeW
  const badgeY = cardY + 28
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 17)
  ctx.fillStyle = theme.badgeBg
  ctx.fill()
  ctx.fillStyle = theme.badgeText
  ctx.font = "800 15px ui-sans-serif, system-ui, -apple-system, sans-serif"
  ctx.textAlign = "center"
  ctx.fillText(badge, badgeX + badgeW / 2, badgeY + 23)
  ctx.textAlign = "left"

  // Title
  ctx.fillStyle = "#ffffff"
  ctx.font = "800 42px ui-sans-serif, system-ui, -apple-system, sans-serif"
  const titleLines = wrapLines(ctx, title, cardW - 80, 2)
  titleLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 40, cardY + 118 + i * 48)
  })

  // Body
  let y = cardY + headerH + 44

  // Meta cards
  const metaGap = 16
  const metaW = (cardW - 80 - metaGap) / 2
  const metaH = 92
  if (dateLabel || timeLabel) {
    if (dateLabel) {
      drawMetaCard(ctx, cardX + 40, y, metaW, metaH, "DATE", dateLabel, theme)
    }
    if (timeLabel) {
      drawMetaCard(ctx, cardX + 40 + metaW + metaGap, y, metaW, metaH, "TIME", timeLabel, theme)
    }
    y += metaH + 24
  }

  if (venueLabel) {
    roundRect(ctx, cardX + 40, y, cardW - 80, 72, 18)
    ctx.fillStyle = theme.accentSoft
    ctx.fill()
    ctx.fillStyle = theme.muted
    ctx.font = "700 13px ui-sans-serif, system-ui, -apple-system, sans-serif"
    ctx.fillText("VENUE", cardX + 60, y + 28)
    ctx.fillStyle = theme.ink
    ctx.font = "600 22px ui-sans-serif, system-ui, -apple-system, sans-serif"
    ctx.fillText(truncate(ctx, venueLabel, cardW - 140), cardX + 60, y + 54)
    y += 96
  }

  // Perforation
  y += 8
  drawPerforation(ctx, cardX, y, cardW, theme.outerFrom)
  y += 36

  // QR well
  const qrSize = 300
  const wellPad = 28
  const wellW = qrSize + wellPad * 2
  const wellH = qrSize + wellPad * 2 + 56
  const wellX = cardX + (cardW - wellW) / 2
  const wellY = y

  roundRect(ctx, wellX, wellY, wellW, wellH, 28)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)"
  ctx.lineWidth = 2
  ctx.stroke()

  // Inner dashed frame
  ctx.save()
  ctx.strokeStyle = theme.accent
  ctx.globalAlpha = 0.35
  ctx.setLineDash([8, 8])
  ctx.lineWidth = 2
  roundRect(ctx, wellX + 14, wellY + 14, wellW - 28, qrSize + wellPad * 2 - 8, 20)
  ctx.stroke()
  ctx.restore()

  const qrImage = await svgToImage(qrSvg, qrSize)
  ctx.drawImage(qrImage, wellX + wellPad, wellY + wellPad, qrSize, qrSize)

  ctx.fillStyle = theme.muted
  ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system, sans-serif"
  ctx.textAlign = "center"
  ctx.fillText(footnote, wellX + wellW / 2, wellY + wellPad + qrSize + 36)
  ctx.textAlign = "left"

  y = wellY + wellH + 36

  // Code footer
  if (codeLabel) {
    roundRect(ctx, cardX + 40, y, cardW - 80, 70, 18)
    ctx.fillStyle = theme.ink
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.font = "700 12px ui-sans-serif, system-ui, -apple-system, sans-serif"
    ctx.fillText(kind === "ticket" ? "TICKET CODE" : "PASS CODE", cardX + 64, y + 26)
    ctx.fillStyle = "#ffffff"
    ctx.font = "600 20px ui-monospace, SFMono-Regular, Menlo, monospace"
    ctx.fillText(truncate(ctx, codeLabel, cardW - 160), cardX + 64, y + 52)
  }

  ctx.restore()

  // Side notches (boarding-pass feel) painted over card edges
  const notchY = cardY + headerH + 8
  ctx.fillStyle = theme.outerFrom
  ctx.beginPath()
  ctx.arc(cardX, notchY, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = theme.outerTo
  ctx.beginPath()
  ctx.arc(cardX + cardW, notchY, 18, 0, Math.PI * 2)
  ctx.fill()

  const link = document.createElement("a")
  link.download = filename
  link.href = canvas.toDataURL("image/png")
  link.click()
}

function drawMetaCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  theme: AccessPassTheme
) {
  roundRect(ctx, x, y, w, h, 18)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)"
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = theme.accent
  ctx.fillRect(x, y + 18, 4, h - 36)

  ctx.fillStyle = theme.muted
  ctx.font = "700 12px ui-sans-serif, system-ui, -apple-system, sans-serif"
  ctx.fillText(label, x + 22, y + 34)
  ctx.fillStyle = theme.ink
  ctx.font = "700 22px ui-sans-serif, system-ui, -apple-system, sans-serif"
  ctx.fillText(truncate(ctx, value, w - 40), x + 22, y + 64)
}

function drawPerforation(
  ctx: CanvasRenderingContext2D,
  cardX: number,
  y: number,
  cardW: number,
  holeColor: string
) {
  ctx.save()
  ctx.strokeStyle = "rgba(15, 23, 42, 0.18)"
  ctx.setLineDash([6, 10])
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cardX + 28, y)
  ctx.lineTo(cardX + cardW - 28, y)
  ctx.stroke()
  ctx.restore()

  // Decorative edge dots
  ctx.fillStyle = holeColor
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(cardX + 18, y - 18 + i * 18, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cardX + cardW - 18, y - 18 + i * 18, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, "transparent")
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines - 1) {
        const rest = [word, ...words.slice(i + 1)].join(" ")
        lines.push(truncate(ctx, rest, maxWidth))
        return lines
      }
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : [truncate(ctx, text, maxWidth)]
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 0 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + "…"
}

function svgToImage(svg: SVGSVGElement, size: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("width", String(size))
  clone.setAttribute("height", String(size))
  const xml = new XMLSerializer().serializeToString(clone)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
