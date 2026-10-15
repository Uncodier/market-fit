import { fireEvent, render, screen } from "@testing-library/react"
import { format } from "date-fns"
import { DueDateField } from "@/app/components/finance/DueDateField"
import { DueDateSummary } from "@/app/components/finance/DueDateSummary"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import messages from "@/app/context/locales/en.json"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    locale: "en",
    t: (key: string) => messages[key as keyof typeof messages] || key,
  }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn(() => false) }))

describe("financial due date controls", () => {
  beforeEach(() => jest.mocked(useIsMobile).mockReturnValue(false))

  it("edits and clears an optional date using date-only values", () => {
    const onChange = jest.fn()
    const { container, rerender } = render(<DueDateField id="due" value="2026-10-20" onChange={onChange} />)
    const trigger = screen.getByLabelText("Due date (optional)")
    expect(trigger).toHaveTextContent("October 20th, 2026")
    expect(trigger).toHaveAttribute("type", "button")
    expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(screen.getByRole("button", { name: format(new Date(2026, 9, 20), "PPPP") })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 9, 21), "PPPP") }))
    expect(onChange).toHaveBeenCalledWith("2026-10-21")
    rerender(<DueDateField id="due" value="2026-10-21" onChange={onChange} />)
    expect(trigger).toHaveTextContent("October 21st, 2026")
    fireEvent.click(screen.getByRole("button", { name: "Clear due date" }))
    expect(onChange).toHaveBeenCalledWith("")
    rerender(<DueDateField id="due" value="" onChange={onChange} />)
    expect(trigger).toHaveTextContent("Select due date")
    expect(screen.queryByRole("button", { name: "Clear due date" })).not.toBeInTheDocument()
  })

  it.each([undefined, null, ""])("allows a missing optional date (%s)", (value) => {
    const onChange = jest.fn()
    render(<DueDateField id="due" value={value} onChange={onChange} />)
    expect(screen.getByLabelText("Due date (optional)")).toHaveTextContent("Select due date")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("keeps selection and clearing disabled", () => {
    const onChange = jest.fn()
    render(<DueDateField id="due" value="2026-10-20" onChange={onChange} disabled />)
    const trigger = screen.getByLabelText("Due date (optional)")
    const clear = screen.getByRole("button", { name: "Clear due date" })
    expect(trigger).toBeDisabled()
    expect(clear).toBeDisabled()
    fireEvent.click(trigger)
    fireEvent.click(clear)
    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("allows historical due dates and associates the help text with the picker", () => {
    const onChange = jest.fn()
    render(<DueDateField id="due" value="2024-02-29" onChange={onChange} description="Optional invoice deadline." />)
    const trigger = screen.getByLabelText("Due date (optional)")
    expect(trigger).toHaveTextContent("February 29th, 2024")
    expect(trigger).toHaveAccessibleDescription("Optional invoice deadline.")
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2024, 1, 28), "PPPP") }))
    expect(onChange).toHaveBeenCalledWith("2024-02-28")
  })

  it("uses the shared mobile date dialog", () => {
    jest.mocked(useIsMobile).mockReturnValue(true)
    const onChange = jest.fn()
    render(<DueDateField id="due" value="2026-10-20" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText("Due date (optional)"))
    expect(screen.getByRole("dialog", { name: "Select date" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 9, 21), "PPPP") }))
    expect(onChange).toHaveBeenCalledWith("2026-10-21")
  })

  it("displays configured and backwards-compatible missing dates", () => {
    const { rerender } = render(<DueDateSummary value="2026-10-20" />)
    expect(screen.getByText("Due date: Oct 20, 2026")).toBeInTheDocument()
    rerender(<DueDateSummary />)
    expect(screen.getByText("Due date: Not set")).toBeInTheDocument()
  })
})