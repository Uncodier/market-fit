import { charsPerLine, type PaperWidthMm } from "./types"

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

function bytes(values: number[]): Uint8Array {
  return Uint8Array.from(values)
}

const ESC_POS_ASCII: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ñ: "n",
  Á: "A",
  É: "E",
  Í: "I",
  Ó: "O",
  Ú: "U",
  Ñ: "N",
  ü: "u",
  Ü: "U",
  ä: "a",
  ö: "o",
  Ä: "A",
  Ö: "O",
  ß: "ss",
  à: "a",
  è: "e",
  ì: "i",
  ò: "o",
  ù: "u",
  â: "a",
  ê: "e",
  î: "i",
  ô: "o",
  û: "u",
  ç: "c",
  Ç: "C",
  ã: "a",
  õ: "o",
  "¿": "?",
  "¡": "!",
  "—": "-",
  "–": "-",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
}

export function toEscPosAscii(text: string): string {
  return String(text || "").replace(/[^\x09\x20-\x7e]/g, (ch) => ESC_POS_ASCII[ch] || " ")
}

function encodeText(text: string): Uint8Array {
  const normalized = toEscPosAscii(text)
  const out = new Uint8Array(normalized.length)
  for (let i = 0; i < normalized.length; i++) {
    out[i] = normalized.charCodeAt(i) & 0x7f
  }
  return out
}

export function wrapText(text: string, width: number): string[] {
  const raw = String(text || "")
  if (!raw) return [""]
  const words = raw.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    if (!word) continue
    if (word.length > width) {
      if (current) {
        lines.push(current)
        current = ""
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width))
      }
      continue
    }
    const next = current ? `${current} ${word}` : word
    if (next.length > width) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [""]
}

export function padLine(left: string, right: string, width: number): string {
  const gap = width - left.length - right.length
  if (gap <= 0) {
    const maxLeft = Math.max(0, width - right.length - 1)
    return `${left.slice(0, maxLeft)} ${right}`.slice(0, width)
  }
  return `${left}${" ".repeat(gap)}${right}`
}

export function lineCols(width: number, double: boolean): number {
  return double ? Math.max(8, Math.floor(width / 2)) : width
}

export function rule(width: number, char = "-"): string {
  return char.repeat(Math.max(1, width))
}

export class EscPosBuilder {
  private chunks: Uint8Array[] = []
  readonly width: number

  constructor(paperWidthMm: PaperWidthMm) {
    this.width = charsPerLine(paperWidthMm)
    this.chunks.push(bytes([ESC, 0x40]))
  }

  text(value: string, align: "left" | "center" | "right" = "left"): this {
    const alignCode = align === "center" ? 1 : align === "right" ? 2 : 0
    this.chunks.push(bytes([ESC, 0x61, alignCode]))
    for (const line of wrapText(value, this.width)) {
      this.chunks.push(encodeText(line))
      this.chunks.push(bytes([LF]))
    }
    this.chunks.push(bytes([ESC, 0x61, 0]))
    return this
  }

  rawLine(value: string): this {
    this.chunks.push(encodeText(value.slice(0, this.width)))
    this.chunks.push(bytes([LF]))
    return this
  }

  bold(on: boolean): this {
    this.chunks.push(bytes([ESC, 0x45, on ? 1 : 0]))
    return this
  }

  size(doubleHeight: boolean, doubleWidth = false): this {
    const n = (doubleWidth ? 0x10 : 0) | (doubleHeight ? 0x01 : 0)
    this.chunks.push(bytes([GS, 0x21, n]))
    return this
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i++) this.chunks.push(bytes([LF]))
    return this
  }

  separator(char = "-"): this {
    return this.rawLine(rule(this.width, char))
  }

  blackBar(heightDots = 4): this {
    const dots = this.width <= 32 ? 384 : 576
    const bytesPerRow = Math.ceil(dots / 8)
    const height = Math.max(1, Math.min(64, heightDots))
    const data = new Uint8Array(bytesPerRow * height)
    data.fill(0xff)
    this.chunks.push(
      bytes([GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, height & 0xff, 0x00]),
    )
    this.chunks.push(data)
    this.chunks.push(bytes([LF]))
    return this
  }

  raw(data: Uint8Array): this {
    this.chunks.push(data)
    return this
  }

  invert(on: boolean): this {
    this.chunks.push(bytes([GS, 0x42, on ? 1 : 0]))
    return this
  }

  underline(on: boolean): this {
    this.chunks.push(bytes([ESC, 0x2d, on ? 2 : 0]))
    return this
  }

  /**
   * Native ESC/POS QR (Function 165/167/181). Many Epson-compatible printers.
   */
  qr(data: string, moduleSize = 4): this {
    const payload = encodeText(data)
    const storeLen = payload.length + 3
    const pL = storeLen & 0xff
    const pH = (storeLen >> 8) & 0xff
    this.chunks.push(bytes([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]))
    this.chunks.push(bytes([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]))
    this.chunks.push(bytes([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30]))
    this.chunks.push(bytes([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]))
    this.chunks.push(payload)
    this.chunks.push(bytes([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]))
    this.chunks.push(bytes([LF]))
    return this
  }

  cut(): this {
    this.feed(3)
    this.chunks.push(bytes([GS, 0x56, 0x00]))
    return this
  }

  build(): Uint8Array {
    return concat(this.chunks)
  }
}

export function qrCommandPrefix(): number[] {
  return [GS, 0x28, 0x6b]
}
