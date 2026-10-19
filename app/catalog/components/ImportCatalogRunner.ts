import { catalogImportByteLength, type CatalogImportRow } from "../import-schema"

export type ImportCatalogMode = "skip" | "update"
export type ImportCatalogError = { rowNumber: number; message: string }
export type ImportCatalogTotals = { created: number; updated: number; skipped: number; errors: ImportCatalogError[] }
export type ImportCatalogBatch = { rows: CatalogImportRow[]; requestId: string }
export const IMPORT_CATALOG_BATCH_BYTES = 400_000
// PostgreSQL JSONB serialization adds spacing. Leave headroom below its 400 KB
// bound so a valid browser batch cannot become permanently unretryable there.
const SAFE_BATCH_BYTES = 380_000

function serializedBytes(value: unknown) {
  return catalogImportByteLength(value)
}

export function createImportCatalogBatches(rows: CatalogImportRow[], siteId: string): ImportCatalogBatch[] {
  const batches: ImportCatalogBatch[] = []
  let batch: ImportCatalogBatch = { rows: [], requestId: crypto.randomUUID() }
  const fits = (items: CatalogImportRow[]) => items.length <= 100 &&
    serializedBytes([siteId, items, "update", batch.requestId]) <= SAFE_BATCH_BYTES
  for (const row of rows) {
    const candidate = [...batch.rows, row]
    if (!fits(candidate)) {
      if (batch.rows.length) batches.push(batch)
      batch = { rows: [], requestId: crypto.randomUUID() }
      if (!fits([row])) throw new Error(`Row ${row.rowNumber} exceeds the 400 KB batch limit.`)
    }
    batch.rows.push(row)
  }
  if (batch.rows.length) batches.push(batch)
  return batches
}

export interface ImportCatalogSession {
  batches: ImportCatalogBatch[]
  mode: ImportCatalogMode
  nextBatch: number
  completedRows: number
  totals: ImportCatalogTotals
}

type ImportAction = (siteId: string, rows: CatalogImportRow[], mode: ImportCatalogMode, requestId: string) =>
  Promise<{ data?: ImportCatalogTotals; error?: string }>

/** No batch is advanced without an acknowledged result. A retry uses the same UUID. */
export async function runImportCatalogSession(
  session: ImportCatalogSession,
  siteId: string,
  action: ImportAction,
  isCurrent: () => boolean,
  shouldStop: () => boolean,
  onProgress: () => void,
): Promise<{ status: "done" | "paused" | "cancelled"; error?: string }> {
  while (session.nextBatch < session.batches.length) {
    if (!isCurrent()) return { status: "cancelled" }
    if (shouldStop()) return { status: "paused" }
    const batch = session.batches[session.nextBatch]
    try {
      const result = await action(siteId, batch.rows, session.mode, batch.requestId)
      if (!isCurrent()) return { status: "cancelled" }
      if (result.error || !result.data) {
        return { status: "paused", error: result.error || "The server did not acknowledge this batch." }
      }
      session.totals.created += result.data.created
      session.totals.updated += result.data.updated
      session.totals.skipped += result.data.skipped
      session.totals.errors.push(...result.data.errors)
      session.completedRows += batch.rows.length
      session.nextBatch += 1
      onProgress()
    } catch {
      if (!isCurrent()) return { status: "cancelled" }
      return { status: "paused", error: "The batch could not be confirmed. Resume to safely retry the same batch." }
    }
  }
  return { status: "done" }
}