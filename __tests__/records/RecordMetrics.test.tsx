import type { ReactNode } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { RecordMetrics } from "@/app/records/[id]/components/RecordMetrics"
import { insightRecord, relationField } from "./insights-test-fixtures"

// Keep the real chart; supply a measurable container in jsdom.
jest.mock("recharts", () => ({
  ...jest.requireActual("recharts"),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => {
    const React = jest.requireActual("react")
    return React.cloneElement(children, { width: 320, height: 200 })
  },
}))

const current = insightRecord({ data: { Revenue: 4000, Retention: 92, Failures: 0 }, relations: { Customer: "customer-1" } })
const older = insightRecord({ id: "older", title: "Earlier observation", created_at: "2026-01-01T12:00:00Z",
  data: { Revenue: 3500, Retention: 94, Failures: 1 }, relations: current.relations })
const props = {
  fields: [
    { id: "revenue", name: "Revenue", label: "Revenue (USD)", type: "number" },
    { id: "retention", name: "Retention", type: "number" },
    { id: "failures", name: "Failures", type: "number" },
    { id: "missing", name: "Missing", type: "number" },
    relationField,
  ],
  formData: current.data, record: current, relationsData: current.relations,
  records: [older, current], historyStatus: "ready" as const,
  relationName: "Customer", relationLabel: "Example Customer",
  onRelationChange: jest.fn(), onRetry: jest.fn(),
}

describe("generic RecordMetrics widget", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn()
  })

  it("shows every number separately, keeps zero, and switches to one metric at a time", () => {
    const { container } = render(<RecordMetrics {...props} />)
    expect(screen.getByRole("radio", { name: /Revenue \(USD\).*4,000/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("radio", { name: "Failures 0" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Missing No data" })).toBeInTheDocument()
    expect(screen.getByText("+500 vs. previous observation")).toBeInTheDocument()
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(1)
    expect(container.querySelector(".recharts-bar")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Retention 92" }))
    expect(screen.getByText("-2 vs. previous observation")).toBeInTheDocument()
    fireEvent.click(screen.getByText("View 2 observations"))
    expect(screen.getByRole("table", { name: "Saved observations for Retention" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Earlier observation" })).toHaveAttribute("href", "/records/older")
    expect(screen.getByRole("img", { name: /Retention over time/ })).toBeInTheDocument()
  })

  it("shows current edits but keeps them out of the timeline and comparisons", () => {
    render(<RecordMetrics {...props} formData={{ ...current.data, Revenue: 8000 }} />)
    expect(screen.getByRole("radio", { name: /Revenue.*Unsaved.*8,000/ })).toBeInTheDocument()
    expect(screen.getByText("+500 vs. previous observation")).toBeInTheDocument()
    fireEvent.click(screen.getByText("View 2 observations"))
    expect(within(screen.getByRole("table")).getByText("4,000")).toBeInTheDocument()
    expect(within(screen.getByRole("table")).queryByText("8,000")).not.toBeInTheDocument()
    expect(screen.getByText("Unsaved changes · history uses saved values.")).toBeInTheDocument()
  })

  it("does not invent a trend for one point or for a missing metric", () => {
    const { container } = render(<RecordMetrics {...props} records={[current]} />)
    expect(screen.getByText(/Not enough history yet/)).toBeInTheDocument()
    expect(container.querySelector(".recharts-wrapper")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Missing No data" }))
    expect(screen.getByText("Missing values are shown as gaps.")).toBeInTheDocument()
    expect(screen.getByText("View 1 observations")).toBeInTheDocument()
  })

  it("updates the visible detail even without history and never submits a surrounding form", () => {
    const submit = jest.fn(event => event.preventDefault())
    const { container } = render(<form onSubmit={submit}><RecordMetrics {...props}
      historyStatus="idle" relationName={null} relationsData={{}} records={[current]} /></form>)
    fireEvent.click(screen.getByRole("radio", { name: "Retention 92" }))
    expect(screen.getByRole("radio", { name: "Retention 92" })).toHaveAttribute("aria-checked", "true")
    expect(container.querySelector("[aria-live]")).toHaveTextContent("Retention92")
    expect(screen.getByText(/Current value only/)).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
  })

  it("distinguishes loading, failure and ambiguous scope without publishing comparisons", () => {
    const { rerender } = render(<RecordMetrics {...props} historyStatus="loading" />)
    expect(screen.getByText("Loading history…")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    rerender(<RecordMetrics {...props} historyStatus="error" />)
    expect(screen.getByText("History unavailable.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry history" }))
    expect(props.onRetry).toHaveBeenCalledTimes(1)
    rerender(<RecordMetrics {...props} historyStatus="idle" relationName={null}
      fields={[...props.fields, { ...relationField, id: "project", name: "Project" }]}
      relationsData={{ ...props.relationsData, Project: "project-1" }} />)
    expect(screen.getByText("Choose a relation below to see this metric’s history.")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("selects a measurement date and discloses missing dates rather than using creation dates", () => {
    render(<RecordMetrics {...props}
      fields={[...props.fields, { id: "measured", name: "Measured", label: "Measurement date", type: "date" }]}
      records={[{ ...older, data: { ...older.data, Measured: "2025-12-01" } }, current]} />)
    fireEvent.click(screen.getByText("History settings"))
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Timeline date" }), { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("option", { name: "Measurement date" }))
    expect(screen.getByText("1 records excluded: no valid date.")).toBeInTheDocument()
    expect(screen.getByText(/Measurement date.*Saved records/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Current record" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("View 1 observations"))
    expect(screen.getByRole("link", { name: "Earlier observation" })).toBeInTheDocument()
    expect(screen.queryByText("+500 vs. previous observation")).not.toBeInTheDocument()
  })

  it("defaults to the category date, reports fallback, and allows explicit creation dates", () => {
    const saved = { ...current, data: { ...current.data, Measured: "2025-12-01" } }
    const record = { ...saved, category: { name: "Measurements", primary_date_field_id: "measured" } }
    render(<RecordMetrics {...props} record={record} formData={record.data} records={[older, saved]}
      fields={[...props.fields, { id: "measured", name: "Measured", label: "Measurement date", type: "date" }]} />)
    expect(screen.getByText("Creation date used for 1 record without a valid primary date.")).toBeInTheDocument()
    expect(screen.queryByText("+500 vs. previous observation")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("History settings"))
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Timeline date" }), { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("option", { name: "Record creation date" }))
    expect(screen.getByText("+500 vs. previous observation")).toBeInTheDocument()
  })
})