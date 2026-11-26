import { printHtml } from "@/lib/printer/transports/browser-print"
import removeMarkdown from "remove-markdown"

export type RecordOutputFormat = "print" | "pdf" | "markdown"
export type RecordOutputDocument = {
  title: string
  metadata: string[]
  description: string
  fields: string[]
  insights?: string[]
}

type Block = { tag: "h1" | "h2" | "p" | "li"; text: string }

function* blocks(doc: RecordOutputDocument, format: RecordOutputFormat): Generator<Block> {
  yield { tag: "h1", text: doc.title }
  for (const text of doc.metadata) yield { tag: "p", text }
  if (doc.description) {
    yield { tag: "h2", text: "Description" }
    yield { tag: "p", text: format === "markdown" ? doc.description : removeMarkdown(doc.description, { stripListLeaders: false }) }
  }
  for (const [heading, items] of [["Fields", doc.fields], ["Insights", doc.insights]] as const) {
    if (!items?.length) continue
    yield { tag: "h2", text: heading }
    for (const text of items) yield { tag: "li", text }
  }
}

function markdown(doc: RecordOutputDocument) {
  const prefix = { h1: "# ", h2: "## ", li: "- ", p: "" }
  let output = ""
  let lastTag: Block["tag"] | undefined
  for (const { tag, text } of blocks(doc, "markdown")) {
    if (lastTag) output += lastTag === "li" && tag === "li" ? "\n" : "\n\n"
    output += prefix[tag] + text
    lastTag = tag
  }
  return output + "\n"
}

function printRecord(doc: RecordOutputDocument) {
  const page = document.implementation.createHTMLDocument(doc.title)
  const style = page.createElement("style")
  style.textContent = `@page { margin: 18mm; }
    body { font: 11pt/1.5 sans-serif; color: #151515; overflow-wrap: anywhere; }
    h1, h2 { line-height: 1.2; break-after: avoid; }
    h2 { font-size: 14pt; border-bottom: 1px solid #ccc; }
    p, li { white-space: pre-wrap; }`
  page.head.append(style)
  let list: HTMLUListElement | undefined
  for (const { tag, text } of blocks(doc, "print")) {
    const node = page.createElement(tag)
    node.textContent = text
    if (tag === "li") {
      if (!list) page.body.append(list = page.createElement("ul"))
      list.append(node)
    } else {
      list = undefined
      page.body.append(node)
    }
  }
  return printHtml("<!doctype html>" + page.documentElement.outerHTML)
}

async function pdfBlob(doc: RecordOutputDocument) {
  const { PDFDocument, PageSizes, StandardFonts } = await import("pdf-lib")
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.title)
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const supported = new Set(normal.getCharacterSet())
  const margin = 48
  let page = pdf.addPage(PageSizes.A4)
  let y = page.getHeight() - margin

  for (const { tag, text } of blocks(doc, "pdf")) {
    const size = tag === "h1" ? 22 : tag === "h2" ? 15 : 11
    const font = tag === "h1" || tag === "h2" ? bold : normal
    const width = page.getWidth() - 2 * margin
    const flush = (line: string) => {
      if (y - size < margin) {
        page = pdf.addPage(PageSizes.A4)
        y = page.getHeight() - margin
      }
      if (line) page.drawText(line, { x: margin, y: y - size, size, font })
      y -= size + 4
    }
    // Standard PDF fonts use WinAnsi. Keep unsupported code points identifiable
    // instead of silently dropping names or failing partway through a document.
    const value = (tag === "li" ? "• " : "") + text.normalize("NFC")
    for (const paragraph of value.split(/\r\n|[\r\n\u2028\u2029]/u)) {
      let line = ""
      let used = 0
      for (const raw of paragraph.match(/\S+/gu) ?? []) {
        const word = Array.from(raw, char => {
          const cp = char.codePointAt(0)!
          return supported.has(cp) ? char : `[U+${cp.toString(16).toUpperCase()}]`
        }).join("")
        if (line) {
          if (used + font.widthOfTextAtSize(" " + word, size) > width) {
            flush(line)
            line = ""
            used = 0
          } else {
            line += " "
            used += font.widthOfTextAtSize(" ", size)
          }
        }
        // Split oversized tokens too (URLs, identifiers, and code-point fallbacks).
        for (const char of word) {
          const advance = font.widthOfTextAtSize(char, size)
          if (used + advance > width) {
            flush(line)
            line = ""
            used = 0
          }
          line += char
          used += advance
        }
      }
      flush(line)
    }
    y -= tag === "li" ? 2 : 6
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" })
}

export async function writeRecordOutput(format: RecordOutputFormat, doc: RecordOutputDocument): Promise<void> {
  if (format === "print") return printRecord(doc)
  const blob = format === "pdf" ? await pdfBlob(doc) : new Blob([markdown(doc)], { type: "text/markdown;charset=utf-8" })
  const stem = doc.title.replace(/[^\p{L}\p{N} _-]+/gu, "-").trim().slice(0, 100).replace(/^[- ]+|[- ]+$/g, "") || "record"
  const link = document.createElement("a")
  link.download = `${stem}.${format === "pdf" ? "pdf" : "md"}`
  link.href = URL.createObjectURL(blob)
  try {
    link.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000)
  }
}