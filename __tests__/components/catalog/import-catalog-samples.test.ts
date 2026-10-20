import JSZip from "jszip"
import { createCatalogImportSample } from "@/app/catalog/import-samples"
import { parseCatalogImportFile } from "@/app/catalog/import-file"
import { CATALOG_IMPORT_FIELDS, inferCatalogImportMapping, normalizeCatalogImportRows } from "@/app/catalog/import-schema"

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

it.each(["csv", "xlsx"] as const)("generates an importable %s template using all supported columns and valid example products", async format => {
  const { blob, fileName } = await createCatalogImportSample(format)
  expect(fileName).toBe(`catalog-sample.${format}`)
  expect(blob.type).toBe(format === "csv" ? "text/csv;charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  const bytes = await readBlob(blob)
  const file = new File([bytes], fileName, { type: blob.type })
  Object.defineProperties(file, {
    arrayBuffer: { value: async () => bytes },
    text: { value: async () => Buffer.from(bytes).toString("utf8") },
  })

  const parsed = await parseCatalogImportFile(file)
  expect(parsed.headers).toEqual(CATALOG_IMPORT_FIELDS.map(field => field.key))
  expect(parsed.rowNumbers).toEqual([2, 3])
  expect(parsed.rows.map(row => row.sku)).toEqual(["001", "002"])
  expect(parsed.rows[1].name).toBe('Notebook & pen set, "Classic"')
  const normalized = normalizeCatalogImportRows(parsed.rows, inferCatalogImportMapping(parsed.headers), "USD")
  expect(normalized.errors).toEqual([])
  expect(normalized.rows).toHaveLength(2)
  expect(normalized.rows[0].item.target_sale_price).toBe(19.99)
  expect(normalized.rows[1].item.cost).toBe(0)
  expect(normalized.rows.every(row => !row.category && !row.item.image_url)).toBe(true)

  if (format === "xlsx") {
    const zip = await JSZip.loadAsync(bytes)
    expect(zip.file("[Content_Types].xml")).not.toBeNull()
    expect(await zip.file("_rels/.rels")!.async("string")).toContain('Target="xl/workbook.xml"')
    const worksheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string")
    expect(worksheet).toContain('<c r="A2" t="inlineStr">')
    expect(worksheet).not.toContain("<f>")
  }
})