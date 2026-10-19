/** @jest-environment node */
import { createImportCatalogBatches, runImportCatalogSession, IMPORT_CATALOG_BATCH_BYTES, type ImportCatalogSession } from "@/app/catalog/components/ImportCatalogRunner"
import { catalogImportByteLength, type CatalogImportRow } from "@/app/catalog/import-schema"

const rows = (count: number): CatalogImportRow[] => Array.from({ length: count }, (_, index) => ({ rowNumber: index + 2, item: { sku: `SKU-${index}`, name: "Product" } }))
function session(count = 205): ImportCatalogSession {
  return { batches: createImportCatalogBatches(rows(count), "site"), mode: "skip", nextBatch: 0, completedRows: 0,
    totals: { created: 0, updated: 0, skipped: 0, errors: [] } }
}
const result = (created: number) => ({ data: { created, updated: 0, skipped: 0, errors: [] } })

describe("catalog batch runner", () => {
  it("caps batches at 100 rows and 400 KB of UTF-8 action arguments", () => {
    expect(createImportCatalogBatches(rows(205), "site").map(batch => batch.rows.length)).toEqual([100, 100, 5])
    const largeRows = rows(100).map(row => ({ ...row, item: { ...row.item, description: "😀".repeat(5000) } }))
    const batches = createImportCatalogBatches(largeRows, "site")
    expect(batches.length).toBeGreaterThan(1)
    for (const batch of batches) {
      expect(catalogImportByteLength(["site", batch.rows, "update", batch.requestId])).toBeLessThanOrEqual(IMPORT_CATALOG_BATCH_BYTES)
      expect(catalogImportByteLength(batch.rows)).toBeLessThanOrEqual(380_000)
    }
    expect(() => createImportCatalogBatches([{ rowNumber: 2, item: { sku: "SKU", name: "Product", description: "X".repeat(400_000) } }], "site")).toThrow("Row 2")
  })

  it("runs sequentially, reports actual acknowledged rows and merges committed results", async () => {
    const active = session()
    const progress = jest.fn()
    const action = jest.fn(async (_site, batch: CatalogImportRow[]) => result(batch.length))
    expect(await runImportCatalogSession(active, "site", action, () => true, () => false, progress)).toEqual({ status: "done" })
    expect(progress).toHaveBeenCalledTimes(3)
    expect(active.completedRows).toBe(205)
    expect(active.totals.created).toBe(205)
    expect(action.mock.calls.map(call => call[1].length)).toEqual([100, 100, 5])
  })

  it.each(["server", "transport"])("pauses on %s error and resumes the same pending UUID without recounting prior batches", async kind => {
    const active = session()
    const action = jest.fn().mockResolvedValueOnce(result(100))
    if (kind === "server") action.mockResolvedValueOnce({ error: "Server unavailable" })
    else action.mockRejectedValueOnce(new Error("Disconnected"))
    action.mockResolvedValueOnce(result(100)).mockResolvedValueOnce(result(5))
    expect((await runImportCatalogSession(active, "site", action, () => true, () => false, () => {})).status).toBe("paused")
    expect(active.completedRows).toBe(100)
    expect(active.totals.created).toBe(100)
    const failedId = action.mock.calls[1][3]
    expect((await runImportCatalogSession(active, "site", action, () => true, () => false, () => {})).status).toBe("done")
    expect(action.mock.calls[2][3]).toBe(failedId)
    expect(active.totals.created).toBe(205)
  })

  it("stops only between batches and retains resumable counts", async () => {
    const active = session()
    let stopped = false
    const action = jest.fn(async () => { stopped = true; return result(100) })
    expect(await runImportCatalogSession(active, "site", action, () => true, () => stopped, () => {})).toEqual({ status: "paused" })
    expect(active.nextBatch).toBe(1)
    expect(active.completedRows).toBe(100)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it("cancels further batches and stale progress on site change or unmount", async () => {
    const active = session()
    let current = true
    const progress = jest.fn()
    const action = jest.fn(async () => { current = false; return result(100) })
    expect(await runImportCatalogSession(active, "site", action, () => current, () => false, progress)).toEqual({ status: "cancelled" })
    expect(action).toHaveBeenCalledTimes(1)
    expect(progress).not.toHaveBeenCalled()
    expect(active.completedRows).toBe(0)
  })
})