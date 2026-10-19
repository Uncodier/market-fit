import { z } from "zod"

export const CATALOG_IMPORT_MAX_ROWS = 20_000
export const CATALOG_IMPORT_MAX_SOURCE_ROW = 100_001
export const CATALOG_IMPORT_BATCH_SIZE = 100
export const CATALOG_IMPORT_MAX_BYTES = 400_000
export const CATALOG_IMPORT_FIELDS = [
  { key: "sku", label: "SKU", aliases: ["sku", "code", "codigo", "reference", "referencia"] },
  { key: "name", label: "Name", aliases: ["name", "nombre", "product", "producto", "title"] },
  { key: "description", label: "Description", aliases: ["description", "descripcion"] },
  { key: "target_sale_price", label: "Sale price", aliases: ["target_sale_price", "price", "precio", "sale price", "precio de venta"] },
  { key: "cost", label: "Cost", aliases: ["cost", "costo", "coste"] },
  { key: "lowest_sale_price", label: "Minimum sale price", aliases: ["lowest_sale_price", "minimum price", "precio minimo"] },
  { key: "currency", label: "Currency", aliases: ["currency", "moneda"] },
  { key: "category", label: "Category", aliases: ["category", "categoria"] },
  { key: "image_url", label: "Image URL", aliases: ["image_url", "image url", "imagen", "imagen url"] },
] as const

export type CatalogImportField = (typeof CATALOG_IMPORT_FIELDS)[number]["key"]
export type CatalogImportMapping = Partial<Record<CatalogImportField, string>>
export type CatalogImportMode = "skip" | "update"
export type CatalogImportError = { rowNumber: number; message: string }

const currencySchema = z.string().regex(/^[A-Z]{3}$/, "Currency must be a three-letter uppercase code")
const moneySchema = z.number().finite().min(0).max(1_000_000_000_000)
  .refine(value => Number(value.toFixed(4)) === value, "Amounts support at most four decimal places")
function validUnicode(value: string): boolean {
  // for...of combines valid surrogate pairs; standalone surrogates remain in
  // this range and cannot be represented by PostgreSQL UTF-8 JSONB strings.
  return [...value].every(char => {
    const point = char.codePointAt(0)!
    return point < 0xd800 || point > 0xdfff
  })
}

function databaseText(maxLength: number) {
  return z.string().max(maxLength)
    .refine(value => !value.includes("\u0000"), "Null characters are not supported")
    .refine(validUnicode, "Invalid Unicode characters are not supported")
}

const imageSchema = databaseText(2048).refine(value => {
  try {
    if (!/^https:\/\//i.test(value) || value.includes("\\") || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443")
  } catch { return false }
}, "Image URL must use HTTPS without credentials, control characters or a custom port")
  .transform(value => new URL(value).href).pipe(z.string().max(2048)
    .regex(/^https:\/\/([a-z0-9][a-z0-9.-]*|\[[0-9a-f:]+\])(:443)?([/?#].*)?$/i, "Image URL has an unsupported hostname"))

export const catalogImportRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(CATALOG_IMPORT_MAX_SOURCE_ROW),
  item: z.object({
    sku: z.string().trim().min(1, "SKU is required").pipe(databaseText(200)),
    name: z.string().trim().min(1, "Name is required").pipe(databaseText(500)),
    description: databaseText(10_000).optional(),
    target_sale_price: moneySchema.optional(),
    cost: moneySchema.optional(),
    lowest_sale_price: moneySchema.optional(),
    currency: currencySchema.optional(),
    image_url: imageSchema.optional(),
  }).strict(),
  category: z.string().trim().min(1).pipe(databaseText(200)).optional(),
  defaultCurrency: currencySchema.optional(),
}).strict()

export type CatalogImportRow = z.infer<typeof catalogImportRowSchema>
export const catalogImportBatchSchema = z.array(catalogImportRowSchema).min(1).max(CATALOG_IMPORT_BATCH_SIZE)
  .superRefine((rows, ctx) => {
    const skus = new Set<string>()
    const rowNumbers = new Set<number>()
    for (const row of rows) {
      if (skus.has(row.item.sku)) ctx.addIssue({ code: "custom", message: "Duplicate SKU in batch" })
      if (rowNumbers.has(row.rowNumber)) ctx.addIssue({ code: "custom", message: "Duplicate source row number in batch" })
      skus.add(row.item.sku)
      rowNumbers.add(row.rowNumber)
    }
    if (catalogImportDatabaseByteLength(rows) > CATALOG_IMPORT_MAX_BYTES) {
      ctx.addIssue({ code: "custom", message: "Import batch is too large" })
    }
  })

/** UTF-8 payload size, shared with the browser without a Node Buffer dependency. */
export function catalogImportByteLength(value: unknown): number {
  let bytes = 0
  for (const char of JSON.stringify(value)) {
    const point = char.codePointAt(0)!
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
  }
  return bytes
}

/** PostgreSQL JSONB renders a space after every comma and object colon. This
 * applies to normalized rows only: finite fixed-range numbers and valid UTF-8. */
export function catalogImportDatabaseByteLength(value: unknown): number {
  if (Array.isArray(value)) {
    return 2 + Math.max(0, value.length - 1) * 2 + value.reduce((sum, item) => sum + catalogImportDatabaseByteLength(item), 0)
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    return 2 + Math.max(0, entries.length - 1) * 2 + entries.reduce((sum, [key, item]) =>
      sum + catalogImportByteLength(key) + 2 + catalogImportDatabaseByteLength(item), 0)
  }
  return catalogImportByteLength(value)
}

function normalizedHeader(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[_-]/g, " ")
}

export function inferCatalogImportMapping(headers: string[]): CatalogImportMapping {
  const mapping: CatalogImportMapping = {}
  for (const field of CATALOG_IMPORT_FIELDS) {
    const matches = headers.filter(header => field.aliases.some(alias => normalizedHeader(alias) === normalizedHeader(header)))
    if (matches.length === 1) mapping[field.key] = matches[0]
  }
  return mapping
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Cells must contain text or numbers, not formulas or objects")
  return String(value).trim()
}

function cellMoney(value: unknown): number {
  if (typeof value === "number") return value
  const text = cellText(value)
  // Accept a single decimal separator. Thousands separators and currency symbols
  // are deliberately rejected rather than silently changing the amount.
  if (!/^\d+(?:[.,]\d{1,4})?$/.test(text)) {
    throw new Error("Use plain non-negative amounts with up to four decimals and no thousands separators")
  }
  return Number(text.replace(",", "."))
}

export function normalizeCatalogImportRows(
  raw: Record<string, unknown>[], mapping: CatalogImportMapping, defaultCurrency: string,
): { rows: CatalogImportRow[]; errors: CatalogImportError[] } {
  const rows: CatalogImportRow[] = []
  const errors: CatalogImportError[] = []
  if (raw.length > CATALOG_IMPORT_MAX_ROWS) throw new Error(`Maximum ${CATALOG_IMPORT_MAX_ROWS.toLocaleString("en-US")} rows per file`)
  if (!mapping.sku || !mapping.name) throw new Error("Map the SKU and Name columns before continuing")
  const columns = Object.values(mapping).filter(Boolean)
  if (new Set(columns).size !== columns.length) throw new Error("Each column can only be mapped once")
  const currency = currencySchema.parse(defaultCurrency.trim().toUpperCase())
  // Count identities before validating unrelated fields. Otherwise an invalid
  // second occurrence would let the first silently win and overwrite a product.
  const skuCounts = new Map<string, number>()
  for (const source of raw) {
    const value = source[mapping.sku]
    if (typeof value !== "string" && typeof value !== "number") continue
    const sku = String(value).trim()
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1)
  }
  for (const [index, source] of raw.entries()) {
    const rowNumber = index + 2
    try {
      const sku = cellText(source[mapping.sku])
      if ((skuCounts.get(sku) ?? 0) > 1) {
        errors.push({ rowNumber, message: `Duplicate SKU in file: ${sku}` })
        continue
      }
      const item: Record<string, unknown> = {}
      let category: string | undefined
      for (const field of CATALOG_IMPORT_FIELDS) {
        const column = mapping[field.key]
        if (!column) continue
        const value = source[column]
        const text = cellText(value)
        if (!text) continue
        if (field.key === "category") category = text
        else if (["cost", "target_sale_price", "lowest_sale_price"].includes(field.key)) item[field.key] = cellMoney(value)
        else item[field.key] = field.key === "currency" ? text.toUpperCase() : text
      }
      const parsed = catalogImportRowSchema.safeParse({ rowNumber, item, defaultCurrency: currency, ...(category ? { category } : {}) })
      if (!parsed.success) {
        errors.push({ rowNumber, message: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") })
        continue
      }
      rows.push(parsed.data)
    } catch (error) {
      errors.push({ rowNumber, message: error instanceof Error ? error.message : "Invalid row" })
    }
  }
  return { rows, errors: errors.sort((a, b) => a.rowNumber - b.rowNumber) }
}