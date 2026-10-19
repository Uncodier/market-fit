import { CATALOG_IMPORT_MAX_SOURCE_ROW } from "../import-schema"

const MAX_EXPANDED_BYTES = 50 * 1024 * 1024
// The reader allocates a dense rectangle, even for only two populated cells.
const MAX_MATRIX_CELLS = 20_001 * 50
const INVALID_ARCHIVE = "The XLSX archive is invalid or uses unsupported paths or ZIP metadata. Export a new XLSX or CSV."
const TOO_LARGE = "The XLSX workbook is too complex or expands beyond 50 MB. Export a smaller workbook or CSV."
const INVALID_XML = "The XLSX workbook contains invalid or unsupported XML. Export a new XLSX or CSV."
const ROW_LIMIT = "Files may contain at most 100,001 source rows, including the header and empty rows."
const unsafeKeys = new Set([...Object.getOwnPropertyNames(Object.prototype), "length"])

type ZipEntry = { name: string; start: number; end: number; size: number; compression: number }

function canonicalPath(path: string): boolean {
  return !!path && !/[\\:%?#\u0000-\u001f\u007f]/.test(path) && path.split("/").every(part =>
    !!part && part !== "." && part !== ".." && !unsafeKeys.has(part))
}

/** Match the central-directory byte ranges used by read-excel-file's unzipSync.
 * A separate local-header Unzip stream can inspect different bytes on a forged ZIP.
 * ZIP64/multipart archives aren't needed for the 10 MB import limit.
 */
function zipDirectory(bytes: Uint8Array, decode: (bytes: Uint8Array, latin1?: boolean) => string): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (offset: number) => view.getUint16(offset, true)
  const u32 = (offset: number) => view.getUint32(offset, true)
  const fail = () => { throw new Error(INVALID_ARCHIVE) }
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && u32(end) !== 0x06054b50) end--
  if (end < 0 || end < bytes.length - 65557 || end + 22 + u16(end + 20) !== bytes.length) fail()
  const count = u16(end + 10)
  const directoryStart = u32(end + 16)
  if (count > 2048) throw new Error(TOO_LARGE)
  if (!count || count !== u16(end + 8) || u16(end + 4) || u16(end + 6) ||
    directoryStart + u32(end + 12) !== end || (end >= 20 && u32(end - 20) === 0x07064b50)) fail()
  const entries: ZipEntry[] = []
  const names = new Set<string>()
  const ranges: { start: number; end: number }[] = []
  let expanded = 0
  let offset = directoryStart
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) fail()
    const flags = u16(offset + 8)
    const compression = u16(offset + 10)
    const compressedSize = u32(offset + 20)
    const size = u32(offset + 24)
    const nameLength = u16(offset + 28)
    const next = offset + 46 + nameLength + u16(offset + 30) + u16(offset + 32)
    const local = u32(offset + 42)
    expanded += size
    if (expanded > MAX_EXPANDED_BYTES) throw new Error(TOO_LARGE)
    if (next > end || u16(offset + 34) || (flags & ~0x080e) || ![0, 8].includes(compression) ||
      local + 30 > directoryStart || u32(local) !== 0x04034b50) fail()
    const name = decode(bytes.subarray(offset + 46, offset + 46 + nameLength), !(flags & 0x800))
    if (!canonicalPath(name.endsWith("/") ? name.slice(0, -1) : name) || names.has(name)) fail()
    names.add(name)
    const start = local + 30 + u16(local + 26) + u16(local + 28)
    if (start + compressedSize > directoryStart || u16(local + 6) !== flags || u16(local + 8) !== compression ||
      u16(local + 26) !== nameLength || decode(bytes.subarray(local + 30, local + 30 + nameLength), !(flags & 0x800)) !== name) fail()
    if (!(flags & 8) && (u32(local + 18) !== compressedSize || u32(local + 22) !== size)) fail()
    if (!compression && size !== compressedSize) fail()
    entries.push({ name, start, end: start + compressedSize, size, compression })
    ranges.push({ start: local, end: start + compressedSize })
    offset = next
  }
  if (offset !== end) fail()
  ranges.sort((a, b) => a.start - b.start)
  if (ranges.some((range, index) => index > 0 && range.start < ranges[index - 1].end)) fail()
  return entries
}

// Match the reader's direct-child/local-name traversal, not regexes over raw XML.
function children(element: Element, name: string): Element[] {
  const matches: Element[] = []
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.localName === name) matches.push(child)
  }
  return matches
}

function oneChild(element: Element, name: string): Element | undefined {
  const matches = children(element, name)
  if (matches.length > 1) throw new Error(INVALID_XML)
  return matches[0]
}

function coordinate(value: string | null): { row: number; column: number } {
  const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(value ?? "")
  if (!match) throw new Error("The XLSX worksheet contains an invalid cell coordinate.")
  let column = 0
  for (const letter of match[1]) {
    column = column * 26 + letter.charCodeAt(0) - 64
    if (column > 50) throw new Error("XLSX worksheets may contain at most 50 columns. Remove distant cells or export CSV.")
  }
  const row = Number(match[2])
  if (!Number.isSafeInteger(row) || row > CATALOG_IMPORT_MAX_SOURCE_ROW) throw new Error(ROW_LIMIT)
  return { row, column }
}

function validateWorksheet(worksheet: Element) {
  const dimension = oneChild(worksheet, "dimension")
  let bounds: { row: number; column: number } | undefined
  if (dimension) {
    const parts = (dimension.getAttribute("ref") ?? "").split(":")
    if (parts.length > 2) throw new Error("The XLSX worksheet dimension is invalid.")
    const start = coordinate(parts[0])
    bounds = coordinate(parts[parts.length - 1])
    if (start.row > bounds.row || start.column > bounds.column) throw new Error("The XLSX worksheet dimension is reversed.")
  }
  const sheetData = oneChild(worksheet, "sheetData")
  if (!sheetData) throw new Error(INVALID_XML)
  let maxRow = 0
  let maxColumn = 0
  const coordinates = new Set<string>()
  const rows = children(sheetData, "row")
  if (rows.length > CATALOG_IMPORT_MAX_SOURCE_ROW) throw new Error(ROW_LIMIT)
  for (const row of rows) {
    const rowReference = row.getAttribute("r")
    if (rowReference !== null && !/^[1-9][0-9]*$/.test(rowReference)) throw new Error("The XLSX worksheet contains an invalid row coordinate.")
    if (rowReference !== null && Number(rowReference) > CATALOG_IMPORT_MAX_SOURCE_ROW) throw new Error(ROW_LIMIT)
    for (const cell of children(row, "c")) {
      const reference = cell.getAttribute("r")
      const position = coordinate(reference)
      if ((rowReference !== null && Number(rowReference) !== position.row) || coordinates.has(reference!)) {
        throw new Error("The XLSX worksheet contains duplicate or inconsistent cell coordinates.")
      }
      coordinates.add(reference!)
      maxRow = Math.max(maxRow, position.row)
      maxColumn = Math.max(maxColumn, position.column)
      if (maxRow * maxColumn > MAX_MATRIX_CELLS) throw new Error("The XLSX worksheet is too sparse or its cell matrix is too large. Export a smaller worksheet or CSV.")
    }
  }
  if (bounds && (maxRow > bounds.row || maxColumn > bounds.column)) {
    throw new Error("The XLSX worksheet dimension excludes cells and would discard data. Save the workbook again or export CSV.")
  }
  if (bounds && bounds.row * bounds.column > MAX_MATRIX_CELLS) {
    throw new Error("The XLSX worksheet is too sparse or its cell matrix is too large. Export a smaller worksheet or CSV.")
  }
}

/** Browser-only preflight, before the reader expands XML and allocates cells. */
export async function validateImportCatalogArchive(buffer: ArrayBuffer): Promise<void> {
  const { unzipSync, strFromU8, Inflate } = await import("fflate")
  const bytes = new Uint8Array(buffer)
  const entries = zipDirectory(bytes, strFromU8)
  let actualBytes = 0
  for (const entry of entries) {
    let size = 0
    if (entry.compression === 0) {
      actualBytes += entry.size
      continue
    }
    const inflate = new Inflate(chunk => {
      size += chunk.length
      actualBytes += chunk.length
      if (actualBytes > MAX_EXPANDED_BYTES) throw new Error(TOO_LARGE)
      // unzipSync trusts the declared size and can otherwise silently truncate XML.
      if (size > entry.size) throw new Error(INVALID_ARCHIVE)
    })
    for (let offset = entry.start; offset < entry.end; offset += 1024) {
      inflate.push(bytes.subarray(offset, Math.min(offset + 1024, entry.end)), offset + 1024 >= entry.end)
    }
    if (size !== entry.size) throw new Error(INVALID_ARCHIVE)
  }
  const names = new Set(entries.map(entry => entry.name))
  const readXml = (path: string, root: string): Element => {
    if (!names.has(path)) throw new Error(INVALID_XML)
    const xml = strFromU8(unzipSync(bytes, { filter: file => file.name === path })[path])
    // Disallow DTDs before DOM parsing; numeric/predefined entities remain valid.
    if (/<!DOCTYPE|<!ENTITY/i.test(xml) || xml.includes("\0")) throw new Error(INVALID_XML)
    const document = new DOMParser().parseFromString(xml, "application/xml")
    if (document.getElementsByTagName("parsererror").length || document.documentElement.localName !== root) throw new Error(INVALID_XML)
    return document.documentElement
  }
  const workbook = readXml("xl/workbook.xml", "workbook")
  const sheets = oneChild(workbook, "sheets")
  const first = sheets && children(sheets, "sheet")[0]
  // The reader skips nameless sheets and only understands the literal r:id.
  if (!first?.getAttribute("name")?.trim() || !first.getAttribute("r:id")) {
    throw new Error("The first worksheet has invalid name or relationship metadata.")
  }
  const relationships = readXml("xl/_rels/workbook.xml.rels", "Relationships")
  const ids = new Set<string>()
  const metadataTypes = new Set<string>()
  let firstPath: string | undefined
  for (const relationship of children(relationships, "Relationship")) {
    const id = relationship.getAttribute("Id") ?? ""
    if (!id || unsafeKeys.has(id) || ids.has(id)) throw new Error(INVALID_XML)
    ids.add(id)
    const type = relationship.getAttribute("Type")?.replace("http://schemas.openxmlformats.org/officeDocument/2006/relationships/", "")
    if (!["worksheet", "sharedStrings", "styles"].includes(type ?? "")) continue
    const target = relationship.getAttribute("Target") ?? ""
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`
    if (relationship.getAttribute("TargetMode") === "External" || !canonicalPath(path)) throw new Error(INVALID_ARCHIVE)
    if (type === "worksheet" && id === first.getAttribute("r:id")) firstPath = path
    if (type === "sharedStrings" || type === "styles") {
      if (metadataTypes.has(type)) throw new Error(INVALID_XML)
      metadataTypes.add(type)
    }
    if (type === "sharedStrings") readXml(path, "sst")
    if (type === "styles") readXml(path, "styleSheet")
  }
  if (!firstPath) throw new Error("The first worksheet relationship is missing or unsupported.")
  validateWorksheet(readXml(firstPath, "worksheet"))
}