import JSZip from "jszip"
import { catalogFileFromCells, catalogImportErrorsCsv, parseCatalogImportFile } from "@/app/catalog/import-file"
import { validateImportCatalogArchive } from "@/app/catalog/components/ImportCatalogArchive"

function csvFile(text: string, name = "catalog.csv") {
  const file = new File([text], name)
  Object.defineProperty(file, "text", { value: async () => text })
  return file
}

function archiveFile(bytes: ArrayBuffer) {
  const file = new File([bytes], "catalog.xlsx")
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes })
  return file
}

async function xlsxFile(firstSheet: string, secondSheet?: string, edit?: (zip: JSZip) => void | Promise<void>, streamFiles = false) {
  const zip = new JSZip()
  const sheets = [firstSheet, ...(secondSheet ? [secondSheet] : [])]
  zip.file("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((_, index) => `<sheet name="Sheet${index + 1}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`)
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`)
  sheets.forEach((sheet, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`))
  await edit?.(zip)
  return archiveFile(await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", streamFiles }))
}

const textCell = (coordinate: string, value: string) => `<c r="${coordinate}" t="inlineStr"><is><t>${value}</t></is></c>`
const simpleSheet = `<row r="1">${textCell("A1", "sku")}</row><row r="2">${textCell("A2", "001")}</row>`

async function replaceXml(zip: JSZip, path: string, from: string, to: string) {
  zip.file(path, (await zip.file(path)!.async("string")).replace(from, to))
}

function directoryRecords(bytes: ArrayBuffer, edit: (view: DataView, central: number, local: number) => void) {
  const view = new DataView(bytes)
  for (let offset = 0; offset < bytes.byteLength - 46; offset++) {
    if (view.getUint32(offset, true) === 0x02014b50) edit(view, offset, view.getUint32(offset + 42, true))
  }
}

describe("catalog file parsing", () => {
  it("parses CSV without coercing SKU leading zeros and preserves physical record positions", async () => {
    const result = await parseCatalogImportFile(csvFile('sku,name,price\r\n001,Widget,0\r\n,,\r\n\r\n002,"Other, item",12.5\r\n'))
    expect(result.headers).toEqual(["sku", "name", "price"])
    expect(result.rows).toEqual([{ sku: "001", name: "Widget", price: "0" }, { sku: "002", name: "Other, item", price: "12.5" }])
    expect(result.rowNumbers).toEqual([2, 5])
  })

  it("skips delimiter-only, quoted-empty and whitespace CSV records", async () => {
    const result = await parseCatalogImportFile(csvFile('sku,name\n,\n"",""\n , \nA,Product'))
    expect(result.rows).toEqual([{ sku: "A", name: "Product" }])
    expect(result.rowNumbers).toEqual([5])
  })

  it("rejects duplicate and empty headers, including case/space collisions", async () => {
    for (const source of ["sku,sku\nA,B", "sku, SKU \nA,B", "sku,\nA,B", ",name\nA,B"]) {
      await expect(parseCatalogImportFile(csvFile(source))).rejects.toThrow(/headers?|column/i)
    }
  })

  it("rejects oversized headers before exposing them in mapping controls", () => {
    expect(() => catalogFileFromCells([["sku", "n".repeat(201)], ["A", "Product"]])).toThrow("200 characters")
    expect(() => catalogFileFromCells([[, "name"], ["A", "Product"]])).toThrow("nonempty header")
  })

  it("rejects malformed quoting, extra columns and empty files", async () => {
    await expect(parseCatalogImportFile(csvFile('sku,name\nA,"unterminated'))).rejects.toThrow("quoting")
    await expect(parseCatalogImportFile(csvFile('sku,name\nA,B,C'))).rejects.toThrow("Row 2")
    await expect(parseCatalogImportFile(csvFile('sku,name\n,\n'))).rejects.toThrow("No catalog items")
    await expect(parseCatalogImportFile(csvFile(""))).rejects.toThrow("empty")
    await expect(parseCatalogImportFile(csvFile(`sku\n${",".repeat(100_000)}`))).rejects.toThrow("50 columns")
  })

  it("rejects .xls and nonapproved formats and enforces 10 MB before parsing", async () => {
    for (const name of ["catalog.xls", "catalog.json", "catalog.txt"]) {
      await expect(parseCatalogImportFile(csvFile("sku,name\nA,B", name))).rejects.toThrow("CSV or XLSX")
    }
    const file = csvFile("sku,name\nA,B")
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 })
    await expect(parseCatalogImportFile(file)).rejects.toThrow("10 MB")
  })

  it("accepts exactly 20,000 nonempty rows and 50 columns, rejects limits above", () => {
    const rows = Array.from({ length: 20_000 }, (_, index) => [String(index), "Product"])
    expect(catalogFileFromCells([["sku", "name"], ...rows]).rows).toHaveLength(20_000)
    expect(() => catalogFileFromCells([["sku", "name"], ...rows, ["extra", "Product"]])).toThrow("20,000")
    const headers = Array.from({ length: 50 }, (_, index) => `Column ${index}`)
    expect(catalogFileFromCells([headers, ["value"]]).headers).toHaveLength(50)
    expect(() => catalogFileFromCells([[...headers, "extra"], ["value"]])).toThrow("50 columns")
  })

  it("reads only the first worksheet of a generated XLSX and preserves zeros/empty rows", async () => {
    const file = await xlsxFile(
      `<row r="1">${textCell("A1", "sku")}${textCell("B1", "name")}${textCell("C1", "price")}</row><row r="2">${textCell("A2", "001")}${textCell("B2", "Widget")}<c r="C2"><v>0</v></c></row><row r="4">${textCell("A4", "002")}${textCell("B4", "Second")}</row>`,
      `<row r="1">${textCell("A1", "not imported")}</row>`,
    )
    const result = await parseCatalogImportFile(file)
    expect(result.rows).toEqual([{ sku: "001", name: "Widget", price: 0 }, { sku: "002", name: "Second", price: "" }])
    expect(result.rowNumbers).toEqual([2, 4])
  })

  it("preserves interior physical columns and distant row numbers without compacting", async () => {
    const headers = `<row r="1">${textCell("A1", "sku")}${textCell("B1", "name")}${textCell("C1", "price")}</row>`
    const file = await xlsxFile(`${headers}<row r="100001">${textCell("A100001", "001")}<c r="C100001"><v>0</v></c></row>`)
    const result = await parseCatalogImportFile(file)
    expect(result.rowNumbers).toEqual([100001])
    expect(result.rows).toEqual([{ sku: "001", name: "", price: 0 }])
  })

  it("does not promote a later XLSX row or column into missing first-row headers", async () => {
    const laterHeader = `<row r="2">${textCell("A2", "sku")}</row><row r="3">${textCell("A3", "001")}</row>`
    await expect(parseCatalogImportFile(await xlsxFile(laterHeader))).rejects.toThrow(/header/i)
    await expect(parseCatalogImportFile(await xlsxFile(simpleSheet.replaceAll('r="A', 'r="B')))).rejects.toThrow(/header/i)
  })

  it("accepts numeric entities, absolute targets and ZIP data descriptors", async () => {
    const file = await xlsxFile(simpleSheet.replaceAll('r="A', 'r="&#65;'), undefined,
      zip => replaceXml(zip, "xl/_rels/workbook.xml.rels", "worksheets/sheet1.xml", "/xl/worksheets/sheet&#49;.xml"), true)
    expect((await parseCatalogImportFile(file)).rows).toEqual([{ sku: "001" }])
  })

  it("reads shared-string metadata at its declared relationship target", async () => {
    const file = await xlsxFile(`<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2">${textCell("A2", "001")}</row>`, undefined, async zip => {
      zip.file("xl/text.xml", '<sst><si><t>sku</t></si></sst>')
      await replaceXml(zip, "xl/_rels/workbook.xml.rels", '</Relationships>', '<Relationship Id="text" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="text.xml"/></Relationships>')
    })
    expect((await parseCatalogImportFile(file)).rows).toEqual([{ sku: "001" }])
  })

  it("rejects duplicate shared-string metadata instead of repeatedly parsing it", async () => {
    const file = await xlsxFile(simpleSheet, undefined, async zip => {
      zip.file("xl/text.xml", '<sst><si><t>sku</t></si></sst>')
      await replaceXml(zip, "xl/_rels/workbook.xml.rels", '</Relationships>', ["one", "two"].map(id => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="text.xml"/>`).join("") + '</Relationships>')
    })
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/XML/i)
  })

  it("ignores unused worksheet coordinates but still selects first workbook order, not sheetId", async () => {
    const file = await xlsxFile(simpleSheet, `<row r="100002">${textCell("AY100002", "unused")}</row>`,
      zip => replaceXml(zip, "xl/workbook.xml", 'sheetId="1"', 'sheetId="99"'))
    expect((await parseCatalogImportFile(file)).rows).toEqual([{ sku: "001" }])
  })

  it("rejects duplicate XLSX headers", async () => {
    await expect(parseCatalogImportFile(await xlsxFile(`<row r="1">${textCell("A1", "sku")}${textCell("B1", "sku")}</row><row r="2">${textCell("A2", "value")}</row>`))).rejects.toThrow("unique")
  })

  it.each(["AY&#49;", "&#65;Y1", " A100002", "A1:AY100002", "A0", "A-1"])("preflights decoded/noncanonical coordinate %s", async coordinate => {
    const file = await xlsxFile(`<row r="1">${textCell(coordinate, "value")}</row>`)
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/coordinate|columns|rows/i)
  })

  it("finds worksheet paths through relationships instead of a filename convention", async () => {
    const file = await xlsxFile(`<row r="1">${textCell("AY1", "value")}</row>`, undefined, async zip => {
      zip.file("xl/catalog.xml", await zip.file("xl/worksheets/sheet1.xml")!.async("string"))
      zip.remove("xl/worksheets/sheet1.xml")
      await replaceXml(zip, "xl/_rels/workbook.xml.rels", "worksheets/sheet1.xml", "catalog.xml")
    })
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow("50 columns")
  })

  it("reads normal first worksheets at nonstandard canonical locations", async () => {
    const file = await xlsxFile(simpleSheet, undefined, async zip => {
      zip.file("xl/catalog.xml", await zip.file("xl/worksheets/sheet1.xml")!.async("string"))
      zip.remove("xl/worksheets/sheet1.xml")
      await replaceXml(zip, "xl/_rels/workbook.xml.rels", "worksheets/sheet1.xml", "catalog.xml")
    })
    expect((await parseCatalogImportFile(file)).rows).toEqual([{ sku: "001" }])
  })

  it.each(["./worksheets/sheet1.xml", "worksheets/../sheet1.xml", "worksheets%2fsheet1.xml", "//xl/worksheets/sheet1.xml", "https://example.invalid/sheet.xml", "worksheets\\sheet1.xml"])("rejects noncanonical relationship target %s", async target => {
    const file = await xlsxFile(simpleSheet, undefined, zip => replaceXml(zip, "xl/_rels/workbook.xml.rels", "worksheets/sheet1.xml", target))
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/paths/i)
  })

  it("rejects noncanonical ZIP entry paths even when the reader accepts their literal targets", async () => {
    const file = await xlsxFile(simpleSheet, undefined, async zip => {
      zip.file("xl/./catalog.xml", await zip.file("xl/worksheets/sheet1.xml")!.async("string"))
      await replaceXml(zip, "xl/_rels/workbook.xml.rels", "worksheets/sheet1.xml", "./catalog.xml")
    })
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/paths/i)
  })

  it.each(['ref="A1:&#65;Y2"', 'ref="A2:A1"', 'ref="A1:A2:A100002"'])("rejects hostile dimension metadata %s", async dimension => {
    const file = await xlsxFile(simpleSheet, undefined, zip => replaceXml(zip, "xl/worksheets/sheet1.xml", "<sheetData>", `<dimension ${dimension}/><sheetData>`))
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/columns|dimension/i)
  })

  it("validates prefixed worksheet tags and entity-encoded row coordinates", async () => {
    const file = await xlsxFile(`<row r="10000&#50;"></row>`, undefined, async zip => {
      await replaceXml(zip, "xl/worksheets/sheet1.xml", '<worksheet xmlns=', '<x:worksheet xmlns:x=')
      await replaceXml(zip, "xl/worksheets/sheet1.xml", '</worksheet>', '</x:worksheet>')
    })
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow("100,001")
  })

  it("rejects dimensions which would silently discard data", async () => {
    const file = await xlsxFile(simpleSheet, undefined, zip => replaceXml(zip, "xl/worksheets/sheet1.xml", "<sheetData>", '<dimension ref="A1"/><sheetData>'))
    await expect(parseCatalogImportFile(file)).rejects.toThrow(/dimension/i)
  })

  it("rejects a nameless first sheet rather than importing the second sheet", async () => {
    const file = await xlsxFile(simpleSheet, simpleSheet, zip => replaceXml(zip, "xl/workbook.xml", 'name="Sheet1"', 'name=""'))
    await expect(parseCatalogImportFile(file)).rejects.toThrow(/first worksheet/i)
  })

  it.each(["__proto__", "constructor"])("rejects unsafe relationship IDs %s", async id => {
    const file = await xlsxFile(simpleSheet, undefined, async zip => {
      await replaceXml(zip, "xl/workbook.xml", "rId1", id)
      await replaceXml(zip, "xl/_rels/workbook.xml.rels", "rId1", id)
    })
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/XML/i)
  })

  it("rejects malformed XML and DTDs before passing XML to the reader", async () => {
    for (const prefix of ['<!DOCTYPE worksheet [<!ENTITY row "100002">]>', '<!DOCTYPE worksheet SYSTEM "https://example.invalid/sheet.dtd">']) {
      const file = await xlsxFile(simpleSheet, undefined, async zip => {
        zip.file("xl/worksheets/sheet1.xml", prefix + await zip.file("xl/worksheets/sheet1.xml")!.async("string"))
      })
      await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/XML/i)
    }
    await expect(parseCatalogImportFile(await xlsxFile("<row>"))).rejects.toThrow(/XML/i)
  })

  it("rejects duplicate and contradictory cell positions", async () => {
    for (const sheet of [`<row r="1">${textCell("A1", "sku")}${textCell("A1", "name")}</row>`, `<row r="1">${textCell("A2", "sku")}</row>`]) {
      await expect(validateImportCatalogArchive(await (await xlsxFile(sheet)).arrayBuffer())).rejects.toThrow(/coordinates/i)
    }
  })

  it("bounds the dense matrix even when sparse coordinates fit each axis", async () => {
    const file = await xlsxFile(simpleSheet, undefined, zip => replaceXml(zip, "xl/worksheets/sheet1.xml", "<sheetData>", '<dimension ref="A1:AX100001"/><sheetData>'))
    await expect(validateImportCatalogArchive(await file.arrayBuffer())).rejects.toThrow(/matrix|sparse/i)
    const implicit = await xlsxFile(`${simpleSheet}<row r="100001">${textCell("AX100001", "value")}</row>`)
    await expect(validateImportCatalogArchive(await implicit.arrayBuffer())).rejects.toThrow(/matrix|sparse/i)
  })

  it.each(['<c r="A1"><v>42</v></c>', '<c r="A1" t="b"><v>1</v></c>', '<c r="A1" t="d"><v>2026-01-01T00:00:00Z</v></c>'])("rejects nontext XLSX headers: %s", async cell => {
    const file = await xlsxFile(`<row r="1">${cell}</row><row r="2">${textCell("A2", "001")}</row>`)
    await expect(parseCatalogImportFile(file)).rejects.toThrow(/header.*text/i)
  })

  it("guards sparse source rows and worksheet coordinates before allocating XLSX cells", async () => {
    expect(() => catalogFileFromCells(Array.from({ length: 100_002 }, () => ["value"])) ).toThrow("100,001")
    await expect(parseCatalogImportFile(await xlsxFile('<row r="100002"><c r="A100002" t="inlineStr"><is><t>value</t></is></c></row>'))).rejects.toThrow("100,001")
    await expect(parseCatalogImportFile(await xlsxFile('<row r="1"><c r="AY1" t="inlineStr"><is><t>value</t></is></c></row>'))).rejects.toThrow("50 columns")
  })

  it("rejects excessive ZIP directory expansion before extracting data", async () => {
    const zip = new JSZip().file("xl/workbook.xml", "synthetic")
    const bytes = await zip.generateAsync({ type: "arraybuffer" })
    const view = new DataView(bytes)
    for (let offset = 0; offset < bytes.byteLength - 24; offset += 1) {
      if (view.getUint32(offset, true) === 0x02014b50) {
        view.setUint32(offset + 24, 51 * 1024 * 1024, true)
        break
      }
    }
    await expect(validateImportCatalogArchive(bytes)).rejects.toThrow("50 MB")
  })

  it("checks actual inflated bytes rather than trusting matching local/central size lies", async () => {
    const file = await xlsxFile(simpleSheet, undefined, zip => { zip.file("padding.txt", "x".repeat(1024 * 1024)) })
    const bytes = await file.arrayBuffer()
    directoryRecords(bytes, (view, central, local) => {
      if (view.getUint32(central + 24, true) > 1024) {
        view.setUint32(central + 24, 10, true)
        view.setUint32(local + 22, 10, true)
      }
    })
    await expect(validateImportCatalogArchive(bytes)).rejects.toThrow(/ZIP metadata/i)
  })

  it("rejects excessive entry counts and short non-ZIP files", async () => {
    const zip = new JSZip()
    for (let index = 0; index < 2049; index++) zip.file(`part${index}`, "")
    await expect(validateImportCatalogArchive(await zip.generateAsync({ type: "arraybuffer" }))).rejects.toThrow(/complex/i)
    await expect(parseCatalogImportFile(archiveFile(new ArrayBuffer(1)))).rejects.toThrow(/archive/i)
  })

  it("rejects central/local disagreement and overlapping compressed ranges", async () => {
    const file = await xlsxFile(simpleSheet)
    const bytes = await file.arrayBuffer()
    directoryRecords(bytes, (view, central, local) => { view.setUint32(local + 22, view.getUint32(central + 24, true) + 1, true) })
    await expect(validateImportCatalogArchive(bytes)).rejects.toThrow(/ZIP metadata/i)
    const overlap = await (await xlsxFile(simpleSheet)).arrayBuffer()
    directoryRecords(overlap, (view, central) => { view.setUint32(central + 42, 0, true) })
    await expect(validateImportCatalogArchive(overlap)).rejects.toThrow(/ZIP metadata/i)
  })

  it("enforces the 20,000-row limit on actual CSV and generated XLSX files", async () => {
    await expect(parseCatalogImportFile(csvFile(`sku\n${"001\n".repeat(20_001)}`))).rejects.toThrow("20,000")
    const rows = Array.from({ length: 20_000 }, (_, index) => `<row r="${index + 2}">${textCell(`A${index + 2}`, "001")}</row>`).join("")
    const sheet = `<row r="1">${textCell("A1", "sku")}</row>${rows}`
    expect((await parseCatalogImportFile(await xlsxFile(sheet))).rows).toHaveLength(20_000)
    await expect(parseCatalogImportFile(await xlsxFile(`${sheet}<row r="20002">${textCell("A20002", "extra")}</row>`))).rejects.toThrow("20,000")
  }, 20_000)
})

describe("catalog error CSV", () => {
  it("escapes quotes/newlines and neutralizes spreadsheet formula injection", () => {
    const csv = catalogImportErrorsCsv([
      { rowNumber: 2, message: '=HYPERLINK("https://example.invalid")' },
      { rowNumber: 3, message: " +1" },
      { rowNumber: 4, message: "@SUM(1)" },
      { rowNumber: 5, message: "\tformula" },
      { rowNumber: 6, message: 'Normal, "quoted"\nerror' },
      { rowNumber: 7, message: "-123" },
    ])
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"')
    expect(csv).toContain('"\' +1"')
    expect(csv).toContain('"\'@SUM(1)"')
    expect(csv).toContain('"\'\tformula"')
    expect(csv).toContain('"Normal, ""quoted""\nerror"')
    expect(csv).toContain('"\'-123"')
  })
})