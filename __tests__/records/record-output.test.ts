import { PDFDocument, PDFPage } from "pdf-lib"
import { writeRecordOutput, type RecordOutputDocument } from "@/app/records/[id]/record-output"
import { printHtml } from "@/lib/printer/transports/browser-print"

jest.mock("@/lib/printer/transports/browser-print", () => ({ printHtml: jest.fn() }))

const doc: RecordOutputDocument = {
  title: "Plan / café",
  metadata: ["Owner: Jo"],
  description: "**Milestones**  \n\n```ts\n  const ready = true\n```",
  fields: ["Status: Active", "Priority: High"],
  insights: ["On schedule"],
}

const createURL = jest.fn<string, [Blob]>(() => "blob:record-test")
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

beforeEach(() => {
  jest.clearAllMocks()
  URL.createObjectURL = createURL
  URL.revokeObjectURL = jest.fn()
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
})

afterEach(() => {
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
  jest.restoreAllMocks()
  jest.useRealTimers()
})

function readDownload() {
  const blob = createURL.mock.calls[0][0]
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

function downloadedLink() {
  const click = jest.mocked(HTMLAnchorElement.prototype.click)
  expect(click).toHaveBeenCalledTimes(1)
  return click.mock.instances[0] as unknown as HTMLAnchorElement
}

it("downloads UTF-8 Markdown without reformatting the description or inventing missing sections", async () => {
  jest.useFakeTimers()
  await writeRecordOutput("markdown", { ...doc, insights: undefined })
  expect(downloadedLink().download).toBe("Plan - café.md")
  expect(createURL.mock.calls[0][0].type).toBe("text/markdown;charset=utf-8")
  jest.runOnlyPendingTimers()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:record-test")
  jest.useRealTimers()
  expect(Buffer.from(await readDownload()).toString("utf8")).toBe(
    `# Plan / café\n\nOwner: Jo\n\n## Description\n\n${doc.description}\n\n## Fields\n\n- Status: Active\n- Priority: High\n`,
  )
})

it("prints only formatted record content, treating even markup in titles and fields as text", async () => {
  const payload = '</title><img src=x onerror="alert(1)"><script>oops()</script>'
  await writeRecordOutput("print", { ...doc, title: payload, fields: [payload] })
  const html = jest.mocked(printHtml).mock.calls[0][0]
  const printed = new DOMParser().parseFromString(html, "text/html")
  expect(printed.title).toBe(payload)
  expect(printed.querySelector("h1")?.textContent).toBe(payload)
  expect(printed.querySelector("script, img, [onerror]")).toBeNull()
  expect(Array.from(printed.querySelectorAll("h2"), h => h.textContent)).toEqual(["Description", "Fields", "Insights"])
  expect(Array.from(printed.querySelectorAll("li"), li => li.textContent)).toEqual([payload, "On schedule"])
  expect(printed.body.textContent).toContain(doc.metadata[0])
  expect(printed.body.textContent).toContain("Milestones")
  expect(printed.body.textContent).toContain("const ready = true")
  expect(printed.body.textContent).not.toMatch(/\*\*|```/)
  expect(createURL).not.toHaveBeenCalled()
})

it("downloads a readable multipage PDF, wrapping long tokens and handling non-WinAnsi text", async () => {
  const draw = jest.spyOn(PDFPage.prototype, "drawText")
  const longToken = "W".repeat(9000)
  await writeRecordOutput("pdf", { ...doc, description: `Résumé 東京 🌍\r\n${longToken}` })
  expect(downloadedLink().download).toBe("Plan - café.pdf")
  expect(createURL.mock.calls[0][0].type).toBe("application/pdf")
  expect(printHtml).not.toHaveBeenCalled()
  const pdf = await PDFDocument.load(new Uint8Array(await readDownload()))
  expect(pdf.getPageCount()).toBeGreaterThan(1)
  const lines = draw.mock.calls.map(([line]) => line)
  expect(lines.filter(line => /^W+$/.test(line)).join("")).toBe(longToken)
  expect(lines).toContain("Résumé [U+6771][U+4EAC] [U+1F30D]")
  for (const text of [doc.title, ...doc.metadata, ...doc.fields, ...doc.insights!]) {
    expect(lines.join("\n")).toContain(text)
  }
  for (const [line, opts] of draw.mock.calls) {
    expect(opts!.y).toBeGreaterThanOrEqual(48)
    expect(opts!.x! + opts!.font!.widthOfTextAtSize(line, opts!.size!)).toBeLessThanOrEqual(pdf.getPage(0).getWidth() - 48)
  }
})