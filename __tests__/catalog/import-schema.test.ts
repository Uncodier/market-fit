/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { catalogImportInFilter, catalogImportLookupChunks } from "@/app/catalog/import-lookups"
import {
  catalogImportBatchSchema, catalogImportByteLength, catalogImportDatabaseByteLength, inferCatalogImportMapping, normalizeCatalogImportRows,
} from "@/app/catalog/import-schema"

describe("catalog import normalization", () => {
  const mapping = { sku: "Code", name: "Name", target_sale_price: "Price", currency: "Currency", category: "Category" } as const

  it("infers accented and conventional headers without guessing ambiguous fields", () => {
    expect(inferCatalogImportMapping(["Código", "Nombre", "Precio", "Moneda"])).toEqual({
      sku: "Código", name: "Nombre", target_sale_price: "Precio", currency: "Moneda",
    })
    expect(inferCatalogImportMapping(["SKU", "Code", "Name"])).toEqual({ name: "Name" })
  })

  it("keeps zero amounts and SKU leading zeros; omits blank fields for updates", () => {
    const result = normalizeCatalogImportRows([
      { Code: "001", Name: "Product", Price: 0, Currency: "", Category: "" },
      { Code: "002", Name: "Second", Price: "25,50", Currency: "mxn", Category: "Clothing" },
    ], mapping, "USD")
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toEqual({ rowNumber: 2, item: { sku: "001", name: "Product", target_sale_price: 0 }, defaultCurrency: "USD" })
    expect(result.rows[1].item).toMatchObject({ currency: "MXN", target_sale_price: 25.5 })
    expect(result.rows[1].category).toBe("Clothing")
  })

  it.each(["$20", "1,234.50", "-1", "1e3", "1.12345", "NaN"])("rejects ambiguous or invalid amount %s", price => {
    const result = normalizeCatalogImportRows([{ Code: "A", Name: "P", Price: price }], mapping, "USD")
    expect(result.rows).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it("uses the same four-decimal amount boundary as PostgreSQL for numeric cells", () => {
    expect(normalizeCatalogImportRows([{ Code: "A", Name: "P", Price: 0.00001 }], mapping, "USD").rows).toEqual([])
    expect(normalizeCatalogImportRows([{ Code: "A", Name: "P", Price: 0.0001 }], mapping, "USD").rows[0].item.target_sale_price).toBe(0.0001)
  })

  it("rejects every occurrence of duplicate SKU instead of first-row-wins", () => {
    const result = normalizeCatalogImportRows([
      { Code: "A", Name: "One" }, { Code: "A", Name: "Two" }, { Code: "B", Name: "Three" },
    ], mapping, "USD")
    expect(result.rows.map(row => row.item.sku)).toEqual(["B"])
    expect(result.errors.map(error => error.rowNumber)).toEqual([2, 3])
  })

  it("also rejects a valid row when another occurrence of its SKU has invalid fields", () => {
    const result = normalizeCatalogImportRows([
      { Code: "A", Name: "Valid", Price: "20" },
      { Code: " A ", Name: "Invalid", Price: "not a price" },
      { Code: "B", Name: "Unrelated", Price: "10" },
    ], mapping, "USD")
    expect(result.rows.map(row => row.item.sku)).toEqual(["B"])
    expect(result.errors.some(error => error.rowNumber === 2 && error.message.includes("Duplicate SKU"))).toBe(true)
  })

  it("canonicalizes HTTPS image URLs before sending the validated batch to PostgreSQL", () => {
    const result = normalizeCatalogImportRows([
      { Code: "A", Name: "Image", Image: "https://imágenes.example.test:443/product photo.png" },
    ], { ...mapping, image_url: "Image" }, "USD")
    expect(result.errors).toEqual([])
    expect(result.rows[0].item.image_url).toBe(new URL("https://imágenes.example.test/product photo.png").href)
  })

  it.each(["https://images.example.test/\nfile", "https://images.example.test/\u0000file", "https:\\\\images.example.test\\file", "https://image_host.example.test/file"])("rejects noncanonical unsafe URL input", Image => {
    const result = normalizeCatalogImportRows([{ Code: "A", Name: "Image", Image }], { ...mapping, image_url: "Image" }, "USD")
    expect(result.rows).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it("rejects invalid Unicode before PostgreSQL JSONB decoding", () => {
    expect(normalizeCatalogImportRows([{ Code: "A", Name: "Bad\ud800" }], mapping, "USD").rows).toEqual([])
    expect(normalizeCatalogImportRows([{ Code: "A", Name: "Good 😀" }], mapping, "USD").errors).toEqual([])
  })

  it("requires mappings, unique mapped columns and a valid default currency", () => {
    expect(() => normalizeCatalogImportRows([], {}, "USD")).toThrow("Map the SKU")
    expect(() => normalizeCatalogImportRows([], { sku: "A", name: "A" }, "USD")).toThrow("only be mapped once")
    expect(() => normalizeCatalogImportRows([], mapping, "INVALID")).toThrow()
  })

  it("normalizes 20,000 rows without truncation and rejects a larger file", () => {
    const raw = Array.from({ length: 20_000 }, (_, index) => ({ Code: `SKU-${index}`, Name: `Product ${index}`, Price: index }))
    const result = normalizeCatalogImportRows(raw, mapping, "USD")
    expect(result.rows).toHaveLength(20_000)
    expect(result.rows.at(-1)?.rowNumber).toBe(20_001)
    expect(result.errors).toEqual([])
    expect(() => normalizeCatalogImportRows([...raw, raw[0]], mapping, "USD")).toThrow("Maximum")
  })

  it("rejects unknown privileged fields, oversized batches, and formulas", () => {
    const row = { rowNumber: 2, item: { sku: "A", name: "Product" } }
    expect(catalogImportBatchSchema.safeParse([{ ...row, site_id: "other-site" }]).success).toBe(false)
    expect(catalogImportBatchSchema.safeParse([{ ...row, item: { ...row.item, status: "active" } }]).success).toBe(false)
    expect(catalogImportBatchSchema.safeParse(Array.from({ length: 101 }, (_, i) => ({ ...row, item: { ...row.item, sku: `${i}` } }))).success).toBe(false)
    expect(normalizeCatalogImportRows([{ Code: "A", Name: { formula: "SUM(A1)" } }], mapping, "USD").errors).toHaveLength(1)
  })

  it("rejects null characters before they can make a JSONB batch unretryable", () => {
    const result = normalizeCatalogImportRows([{ Code: "A", Name: "Product\u0000" }], mapping, "USD")
    expect(result.rows).toEqual([])
    expect(result.errors[0].message).toContain("Null characters")
  })

  it("measures UTF-8 bytes and rejects oversized descriptions across a batch", () => {
    expect(catalogImportByteLength({ text: "á😀" })).toBe(Buffer.byteLength(JSON.stringify({ text: "á😀" })))
    const rows = Array.from({ length: 100 }, (_, i) => ({ rowNumber: i + 2, item: { sku: `${i}`, name: "Product", description: "á".repeat(3000) } }))
    expect(catalogImportBatchSchema.safeParse(rows).success).toBe(false)
  })

  it("includes PostgreSQL JSONB spacing in the batch limit, before the RPC can fail permanently", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ rowNumber: i + 2, item: { sku: `SIZE-${i}`, name: "N", description: "d".repeat(3925) } }))
    expect(catalogImportByteLength(rows)).toBe(399485)
    expect(catalogImportDatabaseByteLength(rows)).toBe(400384)
    expect(catalogImportBatchSchema.safeParse(rows).success).toBe(false)
  })

  it("bounds Unicode SKU lookup URLs independently of the row batch size", () => {
    const values = Array.from({ length: 100 }, (_, i) => `${"製".repeat(190)}-${i}`)
    const chunks = catalogImportLookupChunks(values)
    expect(chunks.flat()).toEqual(values)
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(50)
      expect(chunk.reduce((total, value) => total + encodeURIComponent(JSON.stringify(value)).length + 3, 0)).toBeLessThanOrEqual(3500)
    })
  })

  it("quotes every PostgREST operand and escapes literal quotes/backslashes without changing identity", () => {
    expect(catalogImportInFilter(['"Quoted"', 'Desk 1", blue', 'C:\\item', 'A(B)'])).toBe(
      '("\\"Quoted\\"","Desk 1\\", blue","C:\\\\item","A(B)")',
    )
    expect(catalogImportInFilter(["line\nbreak"])).toBe('("line\nbreak")')
  })

  it.each(["http://images.example.test/a", "https://images.example.test:8080/a"])("rejects unsafe image URL %s", url => {
    const result = normalizeCatalogImportRows([{ Code: "A", Name: "P", Image: url }], { ...mapping, image_url: "Image" }, "USD")
    expect(result.rows).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it("rejects image URLs with synthetic embedded credentials", () => {
    const url = new URL("https://images.example.test/a")
    url.username = randomBytes(12).toString("hex")
    url.password = randomBytes(24).toString("hex")
    const result = normalizeCatalogImportRows([{ Code: "A", Name: "P", Image: url.href }], { ...mapping, image_url: "Image" }, "USD")
    expect(result.rows).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(JSON.stringify(result.errors)).not.toContain(url.username)
    expect(JSON.stringify(result.errors)).not.toContain(url.password)
  })
})