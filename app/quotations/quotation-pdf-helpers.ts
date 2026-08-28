import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"

export type QuotationPdfLocation = {
  name?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
}

export const pdfInk = rgb(0.12, 0.12, 0.14)
export const pdfMuted = rgb(0.42, 0.43, 0.45)
export const pdfRule = rgb(0.85, 0.85, 0.85)
export const pdfSoftFill = rgb(0.97, 0.97, 0.97)

// Helvetica uses WinAnsi: printable ASCII, Latin-1 supplement, and CP1252 extras
// (Euro, dashes, smart quotes). Emojis and C1 controls must be stripped.
const WIN_ANSI_UNSUPPORTED =
  /[^\t\n\r\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/gu

export function sanitizePdfText(text?: string | null): string {
  if (!text) return ""
  return text.replace(WIN_ANSI_UNSUPPORTED, "").replace(/[ \t]{2,}/g, " ")
}

function clean(value?: string | null): string | null {
  const v = value?.trim()
  return v ? v : null
}

/** Deduped address lines for the From block (skips repeating country/name). */
export function formatPdfLocationLines(
  location?: QuotationPdfLocation | null
): string[] {
  if (!location) return []
  const cityLine = [clean(location.city), clean(location.state), clean(location.zip)]
    .filter(Boolean)
    .join(", ")

  const candidates = [
    clean(location.name),
    clean(location.address),
    cityLine || null,
    clean(location.country),
  ].filter(Boolean) as string[]

  const seen = new Set<string>()
  const lines: string[] = []
  for (const line of candidates) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line)
  }
  return lines
}

export function formatPdfLocation(location?: QuotationPdfLocation | null): string | null {
  const lines = formatPdfLocationLines(location)
  return lines.length ? lines.join("\n") : null
}

/** Prefer a real name; avoid printing the same email twice. */
export function resolveBillToLines(lead?: {
  name?: string | null
  email?: string | null
} | null): { primary: string; secondary?: string } {
  const name = clean(lead?.name)
  const email = clean(lead?.email)
  if (name && email && name.toLowerCase() === email.toLowerCase()) {
    return { primary: email }
  }
  if (name && email) return { primary: name, secondary: email }
  if (name) return { primary: name }
  if (email) return { primary: email }
  return { primary: "Client" }
}

export async function embedPdfLogo(
  doc: PDFDocument,
  logoUrl?: string | null
): Promise<PDFImage | null> {
  if (!logoUrl || logoUrl.startsWith("data:image/svg")) return null
  try {
    let bytes: Uint8Array
    let contentType = ""

    if (logoUrl.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(logoUrl)
      if (!match) return null
      contentType = match[1].toLowerCase()
      bytes = Uint8Array.from(Buffer.from(match[2], "base64"))
    } else {
      const res = await fetch(logoUrl)
      if (!res.ok) return null
      contentType = (res.headers.get("content-type") || "").toLowerCase()
      bytes = new Uint8Array(await res.arrayBuffer())
    }

    if (contentType.includes("png") || logoUrl.toLowerCase().includes(".png")) {
      return await doc.embedPng(bytes)
    }
    if (
      contentType.includes("jpeg") ||
      contentType.includes("jpg") ||
      logoUrl.toLowerCase().includes(".jpg") ||
      logoUrl.toLowerCase().includes(".jpeg")
    ) {
      return await doc.embedJpg(bytes)
    }
    try {
      return await doc.embedPng(bytes)
    } catch {
      return await doc.embedJpg(bytes)
    }
  } catch {
    return null
  }
}

export function drawPdfText(
  page: PDFPage,
  text: string,
  opts: {
    x: number
    y: number
    size: number
    font: PDFFont
    color?: ReturnType<typeof rgb>
  }
) {
  const safe = sanitizePdfText(text)
  if (!safe) return
  page.drawText(safe, {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? pdfInk,
  })
}

export function drawPdfWrappedText(
  page: PDFPage,
  text: string,
  opts: {
    x: number
    y: number
    size: number
    font: PDFFont
    color?: ReturnType<typeof rgb>
    maxWidth: number
    lineHeight?: number
  }
): number {
  const {
    x,
    size,
    font,
    color = pdfInk,
    maxWidth,
    lineHeight = size + 4,
  } = opts
  let { y } = opts
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean)
  let line = ""

  const flush = () => {
    if (!line) return
    page.drawText(line, { x, y, size, font, color })
    y -= lineHeight
    line = ""
  }

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      flush()
      line = word
    } else {
      line = next
    }
  }
  flush()
  return y
}

export function drawRightText(
  page: PDFPage,
  text: string,
  opts: {
    right: number
    y: number
    size: number
    font: PDFFont
    color?: ReturnType<typeof rgb>
  }
) {
  const safe = sanitizePdfText(text)
  if (!safe) return
  const width = opts.font.widthOfTextAtSize(safe, opts.size)
  page.drawText(safe, {
    x: opts.right - width,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? pdfInk,
  })
}
