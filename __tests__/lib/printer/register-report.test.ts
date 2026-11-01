import { encodeJob, htmlForJob, thermalHtmlForJob } from "@/lib/printer/templates"
import type { PrintJob, RegisterReportPayload } from "@/lib/printer"
import { closedRegisterSession, registerSession, registerSummary } from "../../pos/register-ui-fixtures"

const payload: RegisterReportPayload = {
  session: closedRegisterSession, summary: registerSummary, locationName: "Main store",
}
const job: PrintJob = { id: "report", module: "pos", template: "register-report", payload }

function htmlText(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html")
  return parsed.body.textContent || ""
}

describe("dedicated register report template", () => {
  it.each([58, 80] as const)("preserves reconciliation and complete audit fields at %s mm", (paper) => {
    const outputs = [
      Buffer.from(encodeJob(job, paper)).toString("ascii"),
      htmlText(htmlForJob(job, paper)), htmlText(thermalHtmlForJob(job, paper)),
    ]
    for (const output of outputs) {
      const normalized = output.replace(/\s/g, "").replace(/\x1b[aE][\x00-\x02]/g, "")
      for (const value of [
        "Cash Register Report", "Immutable closing snapshot", "Main store", "store-1", "site-1", "session-1",
        "USD", "cashier-1", "manager-1", "Opening cash: $100.00", "Cash received: $50.00",
        "Cash in: $20.00", "Cash out: $10.00", "Cash refunds: $5.00", "Expected drawer cash: $155.00",
        "Counted cash: $150.00", "Closing difference: -$5.00", "Total received (all methods): $120.00",
        "Receipt count: 2", "Short by five", "cash: $50.00", "card: $70.00", "movement-1", "cash_in",
        "Float replenishment", "receipt-1", "sale-1", "Tendered: $60.00", "Change: $10.00",
        closedRegisterSession.opened_at, closedRegisterSession.closed_at!,
        registerSummary.movements[0].created_at, registerSummary.receipts[0].received_at,
        "Non-cash payments do not change expected drawer cash", "Historical sales are not reconstructed",
      ]) expect(normalized).toContain(value.replace(/\s/g, ""))
    }
    const bytes = encodeJob(job, paper)
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40])
    expect(Array.from(bytes.slice(-3))).toEqual([0x1d, 0x56, 0])
  })

  it("wraps long identifiers and notes without dropping their tails", () => {
    const long = "audit-" + "x".repeat(100) + "-END"
    const report = { ...job, payload: { ...payload, session: { ...closedRegisterSession, id: long, notes: `first\n${long}` } } }
    const bytes = Buffer.from(encodeJob(report, 58)).toString("ascii")
    // Remove alignment commands and wrapping whitespace to reconstruct the field.
    const text = bytes.replace(/\x1b[aE][\x00-\x02]/g, "").replace(/\s/g, "")
    expect(text).toContain(`Session:${long}`)
    expect(text).toContain(`Closingnotes:first${long}`)
  })

  it("escapes all report data in system HTML without loading assets", () => {
    const unsafe = '<script>alert("unsafe")</script><img src="https://example.com/track">&\'José'
    const report = { ...job, payload: {
      ...payload, locationName: unsafe, session: { ...registerSession, notes: unsafe },
      summary: { ...registerSummary, payment_totals: { [unsafe]: 1 },
        movements: [{ ...registerSummary.movements[0], reason: unsafe }],
        receipts: [{ ...registerSummary.receipts[0], method: unsafe }],
      },
    } }
    const html = htmlForJob(report, 58)
    const parsed = new DOMParser().parseFromString(html, "text/html")
    expect(parsed.querySelectorAll("script,img,iframe,link")).toHaveLength(0)
    expect(parsed.body.textContent?.split(unsafe)).toHaveLength(6)
    expect(html).toContain("size:58mm")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&quot;")
    expect(html).toContain("&#39;")
  })

  it("sanitizes ESC/POS commands and uses the existing ASCII transliteration", () => {
    const report = { ...job, payload: { ...payload, locationName: "José\x1b\x1d\x00SAFE" } }
    const bytes = Buffer.from(encodeJob(report, 80)).toString("ascii")
    expect(bytes).toContain("Jose   SAFE")
    expect(bytes).not.toContain("José")
    expect(bytes).not.toContain("\x1b\x1d\x00SAFE")
  })

  it("clearly designates a live preview and keeps null closing values distinct from zero", () => {
    const html = htmlForJob({ ...job, payload: { ...payload, session: registerSession } }, 80)
    expect(htmlText(html)).toContain("Live session preview — not a closing report")
    expect(htmlText(html)).toContain("Counted cash: —")
    expect(htmlText(html)).not.toContain("Immutable closing snapshot")
  })

  it.each([encodeJob, htmlForJob, thermalHtmlForJob])("enforces snapshot correctness even when called directly", (render) => {
    const arbitrary = { ...registerSummary, expected_amount: 999 }
    expect(() => render({ ...job, payload: {
      ...payload, session: { ...closedRegisterSession, snapshot: null }, summary: arbitrary,
    } }, 80)).toThrow("closing snapshot is unavailable")
    const result = render({ ...job, payload: { ...payload, summary: arbitrary } }, 80)
    const text = typeof result === "string" ? htmlText(result) : Buffer.from(result).toString("ascii")
    expect(text).toContain("$155.00")
    expect(text).not.toContain("$999.00")
  })

  it("does not truncate movement or receipt arrays or alter report data", () => {
    const summary = { ...registerSummary,
      movements: Array.from({ length: 125 }, (_, i) => ({ ...registerSummary.movements[0], id: `movement-${i}-END` })),
      receipts: Array.from({ length: 125 }, (_, i) => ({ ...registerSummary.receipts[0], id: `receipt-${i}-END` })),
    }
    const report = { ...job, payload: { ...payload, session: { ...closedRegisterSession, snapshot: summary } } }
    const before = JSON.stringify(report)
    for (const render of [encodeJob, htmlForJob, thermalHtmlForJob]) {
      const result = render(report, 58)
      const text = typeof result === "string" ? htmlText(result) : Buffer.from(result).toString("ascii")
      expect(text).toContain("movement-124-END")
      expect(text).toContain("receipt-124-END")
    }
    expect(JSON.stringify(report)).toBe(before)
  })
})