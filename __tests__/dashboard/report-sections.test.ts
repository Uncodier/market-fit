import { REPORTS, getReportSection, isReportId, reportSectionUrl, type ReportId } from "@/app/dashboard/report-sections"

describe("report section navigation", () => {
  it.each(Object.keys(REPORTS) as ReportId[])("has unique sections and a valid default for %s", (report) => {
    const ids = REPORTS[report].sections.map(section => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(getReportSection(report, null)).toBe(ids[0])
    expect(getReportSection(report, "unknown")).toBe(ids[0])
    for (const id of ids) expect(getReportSection(report, id)).toBe(id)
  })

  it("does not interpret inherited object properties as report names", () => {
    expect(isReportId("constructor")).toBe(false)
    expect(isReportId("__proto__")).toBe(false)
    expect(isReportId("sales")).toBe(true)
    expect(isReportId(null)).toBe(false)
  })

  it("preserves the report and unrelated query parameters when selecting a section", () => {
    const url = reportSectionUrl("tab=sales&artifact=true&section=summary", "sales", "categories")
    const params = new URL(url, "http://localhost").searchParams
    expect(params.get("tab")).toBe("sales")
    expect(params.get("section")).toBe("categories")
    expect(params.get("artifact")).toBe("true")
  })

  it("resolves sections within the selected report, not across reports", () => {
    expect(getReportSection("analytics", "usage")).toBe("distribution")
    expect(reportSectionUrl("", "performance", "https://untrusted.test")).toBe("/dashboard?tab=performance&section=outcomes")
  })
})