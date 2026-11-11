import { fireEvent, render, screen } from "@testing-library/react"
import { RecordDateFilter } from "@/app/records/components/RecordDateFilter"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "All time" }) }))
jest.mock("@/app/components/ui/date-range-picker", () => ({
  CalendarDateRangePicker: ({ onRangeChange }: { onRangeChange: (start: Date, end: Date) => void }) =>
    <button onClick={() => onRangeChange(new Date(2026, 9, 11), new Date(2026, 10, 10))}>Choose dates</button>,
}))

it("starts without a date restriction and lets the user remove an explicit range", () => {
  const onChange = jest.fn()
  const { rerender } = render(<RecordDateFilter value={null} onChange={onChange} />)
  expect(screen.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(screen.getByRole("button", { name: "Choose dates" }))
  expect(onChange).toHaveBeenLastCalledWith({ startDate: new Date(2026, 9, 11), endDate: new Date(2026, 10, 10) })
  rerender(<RecordDateFilter value={onChange.mock.calls[0][0]} onChange={onChange} />)
  fireEvent.click(screen.getByRole("button", { name: "All time" }))
  expect(onChange).toHaveBeenLastCalledWith(null)
})