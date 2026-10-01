import { downloadReportExport, reportExportCsv, reportExportCsvCell, reportExportFilename, REPORT_EXPORT_COLUMNS } from "@/app/dashboard/export/report-export-csv"
import type { ReportExportScope } from "@/app/dashboard/export/report-export-data"

const scope: ReportExportScope = {
  report: "sales", section: "summary", siteId: "site-123", siteName: "Café, Inc.", userId: "do-not-export-this-user",
  segmentId: "segment-456", segmentName: "Selected segment", startDate: "2026-09-01", endDate: "2026-09-30", timeZone: "America/New_York",
}

/** Minimal RFC 4180 reader to assert round trips, including quoted newlines. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index]
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') { cell += '"'; index++ }
      else quoted = !quoted
    } else if (!quoted && char === ",") { row.push(cell); cell = "" }
    else if (!quoted && char === "\r" && csv[index + 1] === "\n") {
      row.push(cell); rows.push(row); row = []; cell = ""; index++
    } else cell += char
  }
  return rows
}

describe("normalized CSV", () => {
  test("has consistent scope/dataset/path/value/availability columns and preserves full numeric precision", () => {
    const csv = reportExportCsv(scope, [{ id: "revenue", data: {
      totalSales: { actual: 123.12345678901235, previous: -8.123456789012345, percentChange: null },
      transactions: { actual: 0 }, currency: "EUR", monthlyData: [],
      metadata: { basis: "No conversion" },
    } }])
    const [header, ...data] = parseCsv(csv)
    expect(header).toEqual(REPORT_EXPORT_COLUMNS)
    expect(data.length).toBeGreaterThan(5)
    for (const row of data) {
      expect(row).toHaveLength(header.length)
      expect(row.slice(0, 9)).toEqual(["sales", "summary", "site-123", "Café, Inc.", "2026-09-01", "2026-09-30", "America/New_York", "segment-456", "Selected segment"])
      expect(row[9]).toBe("revenue")
    }
    const metricRows = data.filter(row => row[10] === "$.totalSales")
    expect(metricRows.find(row => row[11] === "actual")?.slice(-2)).toEqual(["123.12345678901235", "available"])
    expect(metricRows.find(row => row[11] === "previous")?.slice(-2)).toEqual([String(-8.123456789012345), "available"])
    expect(metricRows.find(row => row[11] === "percentChange")?.slice(-2)).toEqual(["", "unavailable"])
    expect(data.find(row => row[10] === "$.transactions" && row[11] === "actual")?.slice(-2)).toEqual(["0", "available"])
    expect(data.find(row => row[11] === "monthlyData")?.slice(-2)).toEqual(["", "empty"])
    expect(csv).not.toContain("do-not-export-this-user")
    expect(csv).not.toContain("[object Object]")
    expect(csv.endsWith("\r\n")).toBe(true)
  })
  test("quotes commas, quotes and multiline strings without losing data", () => {
    const title = 'A "quoted", multiline\r\npost\nwith café'
    const csv = reportExportCsv({ ...scope, report: "social", section: "posts" }, [{ id: "social-performance", data: {
      data: [{ content: { title } }], metadata: { postCount: 1 },
    } }])
    const data = parseCsv(csv)
    expect(data.find(row => row[10] === "$.data[0].content" && row[11] === "title")?.[12]).toBe(title)
    expect(csv).toContain('"A ""quoted"", multiline\r\npost\nwith café"')
  })
  test.each(["=SUM(A1:A2)", "+cmd", "-cmd", "@SUM(A1)", "\tformula", "\rcmd", "\ncmd", "  =SUM(1)", "\u0000=HYPERLINK(1)"])("neutralizes formula string %j", value => {
    expect(reportExportCsvCell(value)).toBe(`"'${value}"`)
  })
  test.each([-123.456789012345, -1, 0, 1.5, 1e-30])("preserves negative and small numeric values %s", value => {
    expect(reportExportCsvCell(value)).toBe(`"${value}"`)
  })
  test("escapes numeric strings and protects untrusted scope labels as well as data", () => {
    expect(reportExportCsvCell("-123.45")).toBe('"\'-123.45"')
    const csv = reportExportCsv({ ...scope, siteName: '=HYPERLINK("https://example.test")', segmentName: "@SUM(1)" }, [])
    const row = parseCsv(csv)[1]
    expect(row[3]).toBe('\'=HYPERLINK("https://example.test")')
    expect(row[8]).toBe("'@SUM(1)")
    expect(row.slice(-2)).toEqual(["", "missing"])
  })
  test("null and boolean scalars are explicit and non-formula text is preserved", () => {
    expect(reportExportCsvCell(null)).toBe('""')
    expect(reportExportCsvCell(false)).toBe('"false"')
    expect(reportExportCsvCell("normal - text")).toBe('"normal - text"')
  })
})

describe("export filename", () => {
  test("contains safe site name/ID, report, section and selected calendar dates", () => {
    expect(reportExportFilename(scope)).toBe("cafe-inc_site-123_sales_summary_2026-09-01_2026-09-30.csv")
    expect(reportExportFilename({ ...scope, report: "traffic", section: "audience" })).toContain("traffic_audience")
  })
  test("does not recompute dates in another timezone, leak identity or include unsafe path characters", () => {
    const filename = reportExportFilename({ ...scope, siteName: '../../"<>|:*?\n', siteId: "../../path", startDate: "2026-09-01T00:00:00-05:00", endDate: "2026-09-30T23:59:59-05:00" })
    expect(filename).toBe("site_path_sales_summary_2026-09-01_2026-09-30.csv")
    expect(filename).not.toMatch(/[\/\\<>:"|?*\r\n]/)
    expect(filename).not.toContain(scope.userId)
  })
  test("bounds very long labels", () => {
    expect(reportExportFilename({ ...scope, siteName: "a".repeat(500), siteId: "b".repeat(500) }).length).toBeLessThan(160)
  })
})

describe("CSV browser download", () => {
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  let clicked: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    URL.createObjectURL = jest.fn(() => "blob:report-export")
    URL.revokeObjectURL = jest.fn()
    clicked = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.useRealTimers()
    clicked.mockRestore()
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })
  function text(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
  }
  test("downloads a UTF-8 BOM blob and revokes/removes temporary browser resources", async () => {
    const csv = '"Café"\r\n'
    downloadReportExport(csv, "report.csv")
    expect(clicked).toHaveBeenCalledTimes(1)
    const anchor = clicked.mock.instances[0] as HTMLAnchorElement
    expect(anchor?.download).toBe("report.csv")
    expect(anchor?.href).toBe("blob:report-export")
    expect(document.querySelector('a[download="report.csv"]')).toBeNull()
    const blob = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob
    expect(blob.type).toBe("text/csv;charset=utf-8")
    expect(blob.size).toBe(new Blob([csv]).size + 3)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    jest.runOnlyPendingTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report-export")
    jest.useRealTimers()
    expect(await text(blob)).toBe(csv)
  })
  test("releases object URLs and temporary anchors even when the click fails", () => {
    clicked.mockImplementation(() => { throw new Error("Download blocked") })
    expect(() => downloadReportExport("data", "report.csv")).toThrow("Download blocked")
    expect(document.querySelector('a[download="report.csv"]')).toBeNull()
    jest.runOnlyPendingTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report-export")
  })
})