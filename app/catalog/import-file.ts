import { CATALOG_IMPORT_MAX_SOURCE_ROW } from "./import-schema"

export const CATALOG_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024
export const CATALOG_IMPORT_MAX_ROWS = 20_000
export const CATALOG_IMPORT_MAX_COLUMNS = 50

export interface ParsedCatalogFile {
  headers: string[]
  rows: Record<string, unknown>[]
  rowNumbers: number[]
}

const isEmpty = (value: unknown) => value == null || String(value).trim() === ""

/** Keep source positions separate from compacted rows used by the normalizer. */
export function catalogFileFromCells(cells: unknown[][]): ParsedCatalogFile {
  if (!cells.length) throw new Error("The file is empty. Add a header row and catalog items.")
  if (cells.length > CATALOG_IMPORT_MAX_SOURCE_ROW) {
    throw new Error("Files may contain at most 100,001 source rows, including the header and empty rows.")
  }
  if (cells.some(row => row.length > CATALOG_IMPORT_MAX_COLUMNS)) {
    throw new Error("Files may contain at most 50 columns.")
  }
  if (cells[0].some(value => value != null && typeof value !== "string")) {
    throw new Error("Column headers must be text. Replace numeric, boolean or date headers with names.")
  }
  const headers = Array.from(cells[0], value => typeof value === "string" ? value.trim() : "")
  if (headers.some(header => header.length > 200)) {
    throw new Error("Column headers must be 200 characters or shorter.")
  }
  if (!headers.length || headers.some(header => !header)) {
    throw new Error("Every column must have a nonempty header in the first row.")
  }
  if (new Set(headers.map(header => header.toLowerCase())).size !== headers.length) {
    throw new Error("Column headers must be unique (ignoring case and surrounding spaces).")
  }
  const rows: Record<string, unknown>[] = []
  const rowNumbers: number[] = []
  cells.slice(1).forEach((values, index) => {
    if (values.every(isEmpty)) return
    if (values.length > headers.length) {
      throw new Error(`Row ${index + 2} has values without column headers.`)
    }
    if (rows.length >= CATALOG_IMPORT_MAX_ROWS) {
      throw new Error("Files may contain at most 20,000 nonempty data rows.")
    }
    rows.push(Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])))
    rowNumbers.push(index + 2)
  })
  if (!rows.length) throw new Error("No catalog items were found below the header row.")
  return { headers, rows, rowNumbers }
}

export async function parseCatalogImportFile(file: File): Promise<ParsedCatalogFile> {
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Use a CSV or XLSX file. Legacy XLS files are not supported.")
  }
  if (file.size > CATALOG_IMPORT_MAX_FILE_BYTES) throw new Error("The file must be 10 MB or smaller.")
  if (!file.size) throw new Error("The file is empty.")

  let cells: unknown[][]
  if (extension === "csv") {
    const { default: Papa } = await import("papaparse")
    cells = []
    let nonemptyRows = 0
    Papa.parse<string[]>(await file.text(), { header: false, skipEmptyLines: false, step: parsed => {
      // A single-column file is valid; delimiter inference is not a structural error.
      if (parsed.errors.some(error => error.code !== "UndetectableDelimiter")) {
        throw new Error("The CSV could not be read. Check its quoting and delimiters.")
      }
      if (parsed.data.length > CATALOG_IMPORT_MAX_COLUMNS) throw new Error("Files may contain at most 50 columns.")
      if (cells.length >= CATALOG_IMPORT_MAX_SOURCE_ROW) {
        throw new Error("Files may contain at most 100,001 source rows, including the header and empty rows.")
      }
      if (cells.length && !parsed.data.every(isEmpty) && ++nonemptyRows > CATALOG_IMPORT_MAX_ROWS) {
        throw new Error("Files may contain at most 20,000 nonempty data rows.")
      }
      cells.push(parsed.data)
    } })
  } else {
    const buffer = await file.arrayBuffer()
    const { validateImportCatalogArchive } = await import("./components/ImportCatalogArchive")
    await validateImportCatalogArchive(buffer)
    const { default: readXlsxFile } = await import("read-excel-file")
    try {
      cells = await readXlsxFile(buffer, { sheet: 1 })
    } catch {
      throw new Error("The XLSX file could not be read. Save it as a valid XLSX workbook and try again.")
    }
  }
  return catalogFileFromCells(cells)
}

/** Quote all cells and neutralize formulas, including whitespace-prefixed formulas. */
export function catalogImportErrorsCsv(errors: { rowNumber: number; message: string }[]): string {
  const escape = (value: unknown) => {
    let text = String(value)
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return [["Row", "Error"], ...errors.map(error => [error.rowNumber, error.message])]
    .map(row => row.map(escape).join(",")).join("\r\n")
}