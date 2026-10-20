import { CATALOG_IMPORT_FIELDS, type CatalogImportField } from "./import-schema"

export type CatalogImportSampleFormat = "csv" | "xlsx"

// Leave site-specific categories and image URLs empty so both examples pass review.
const SAMPLE_PRODUCTS: Record<CatalogImportField, string | number>[] = [
  {
    sku: "001", name: "Stainless steel bottle", description: "Reusable bottle, 750 ml",
    target_sale_price: 19.99, cost: 9.5, lowest_sale_price: 14.99, currency: "USD",
    category: "", image_url: "",
  },
  {
    sku: "002", name: 'Notebook & pen set, "Classic"', description: "A5 notebook with a matching pen",
    target_sale_price: 12.5, cost: 0, lowest_sale_price: 10, currency: "USD",
    category: "", image_url: "",
  },
]

const escapeXml = (value: string | number) => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;")

/** Produce real supported files, not tab-separated text with an Excel extension. */
export async function createCatalogImportSample(format: CatalogImportSampleFormat): Promise<{ blob: Blob; fileName: string }> {
  const headers = CATALOG_IMPORT_FIELDS.map(field => field.key)
  const cells: (string | number)[][] = [headers, ...SAMPLE_PRODUCTS.map(product => headers.map(key => product[key]))]

  if (format === "csv") {
    const content = cells.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n")
    return { blob: new Blob([content], { type: "text/csv;charset=utf-8" }), fileName: "catalog-sample.csv" }
  }

  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  const packageRels = "http://schemas.openxmlformats.org/package/2006/relationships"
  const sheetRows = cells.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => {
    const coordinate = `${String.fromCharCode(65 + column)}${index + 1}`
    // Inline strings preserve SKU leading zeros when the workbook is opened in Excel.
    return typeof value === "number"
      ? `<c r="${coordinate}"><v>${value}</v></c>`
      : `<c r="${coordinate}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
  }).join("")}</row>`).join("")

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`)
  zip.file("_rels/.rels", `<Relationships xmlns="${packageRels}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file("xl/workbook.xml", `<workbook xmlns="${main}" xmlns:r="${office}"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>`)
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="${packageRels}"><Relationship Id="rId1" Type="${office}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)
  zip.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="${main}"><dimension ref="A1:I${cells.length}"/><sheetData>${sheetRows}</sheetData></worksheet>`)

  const bytes = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
  return {
    blob: new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileName: "catalog-sample.xlsx",
  }
}