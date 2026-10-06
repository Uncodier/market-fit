import { fireEvent, render, screen } from "@testing-library/react"
import { DueDateField } from "@/app/components/finance/DueDateField"
import { DueDateSummary } from "@/app/components/finance/DueDateSummary"

describe("financial due date controls", () => {
  it("edits and clears an optional date using date-only values", () => {
    const onChange = jest.fn()
    const { rerender } = render(<DueDateField id="due" value="2026-10-20" onChange={onChange} />)
    const input = screen.getByLabelText("Due date (optional)")
    expect(input).toHaveValue("2026-10-20")
    expect(input).not.toBeRequired()
    fireEvent.change(input, { target: { value: "2026-10-21" } })
    expect(onChange).toHaveBeenCalledWith("2026-10-21")
    rerender(<DueDateField id="due" value="2026-10-21" onChange={onChange} />)
    fireEvent.change(input, { target: { value: "" } })
    expect(onChange).toHaveBeenCalledWith("")
  })
  it("displays configured and backwards-compatible missing dates", () => {
    const { rerender } = render(<DueDateSummary value="2026-10-20" />)
    expect(screen.getByText("Due date: Oct 20, 2026")).toBeInTheDocument()
    rerender(<DueDateSummary />)
    expect(screen.getByText("Due date: Not set")).toBeInTheDocument()
  })
})