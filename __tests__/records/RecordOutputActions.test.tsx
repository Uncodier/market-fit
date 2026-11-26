import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { getRecords } from "@/app/records/actions"
import { RecordOutputActions } from "@/app/records/[id]/components/RecordOutputActions"
import { RecordInsightProvider } from "@/app/records/[id]/components/record-insight-context"
import { writeRecordOutput } from "@/app/records/[id]/record-output"
import { insightRecord } from "./insights-test-fixtures"

jest.mock("@/app/records/actions", () => ({ getRecords: jest.fn() }))
jest.mock("@/app/records/[id]/record-output", () => ({ writeRecordOutput: jest.fn() }))

function setup() {
  const draft = {
    title: "Unsaved title", description: "**New** content", status: "draft",
    fields: [{ id: "amount", name: "amount", label: "Amount paid", type: "number" }],
    formData: { amount: 0 }, relationsData: {},
  }
  render(<RecordInsightProvider {...draft} record={insightRecord()} visible={false}>
    <RecordOutputActions draft={draft} pendingEdits={false} />
  </RecordInsightProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getRecords).mockResolvedValue({ records: [insightRecord({ data: { amount: 15 } })], error: null })
})

it("does not print or fetch insights on cancel; prints draft content without insights by default", async () => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: "Print record" }))
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(writeRecordOutput).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Print record" }))
  expect(screen.getByRole("checkbox", { name: "Include insights" })).not.toBeChecked()
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Print" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(writeRecordOutput).toHaveBeenCalledWith("print", {
    title: "Unsaved title", description: "**New** content", metadata: ["Status: draft"], fields: [{ label: "Amount paid", value: "0" }],
  })
  expect(getRecords).not.toHaveBeenCalled()
})

it.each([["markdown", "Markdown (.md)", "Export Markdown"], ["pdf", "PDF (.pdf)", "Export PDF"]])(
  "exports %s with real analytical summaries even when the sidebar is closed", async (format, item, action) => {
    setup()
    fireEvent.keyDown(screen.getByRole("button", { name: "Export record" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitem", { name: item }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Include insights" }))
    const submit = screen.getByRole("button", { name: action })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(writeRecordOutput).toHaveBeenCalledWith(format, expect.objectContaining({
      insights: expect.arrayContaining(["Category amount: average 15.0, range 15–15"]),
    }))
  },
)