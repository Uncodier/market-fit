import { fireEvent, render, screen } from "@testing-library/react"
import {
  ProgressiveStatusBar,
  type ProgressiveStatusBarProps,
} from "@/app/components/ui/progressive-status-bar"

type Status = "new" | "contacted" | "qualified" | "converted" | "lost" | "won"

const FORWARD_PATH: Status[] = ["new", "contacted", "qualified", "converted"]
const OUTCOMES: Status[] = ["lost", "won"]
const STYLES: Record<Status, string> = {
  new: "bg-blue-100",
  contacted: "bg-yellow-100",
  qualified: "bg-indigo-100",
  converted: "bg-green-100",
  lost: "bg-gray-100",
  won: "bg-emerald-100",
}
const LABELS: Record<Status, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
  won: "Won",
}

function renderBar(overrides: Partial<ProgressiveStatusBarProps<Status>> = {}) {
  const onChange = jest.fn()
  const result = render(
    <ProgressiveStatusBar
      current="contacted"
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      styles={STYLES}
      labels={LABELS}
      onChange={onChange}
      {...overrides}
    />
  )
  return { ...result, onChange }
}

describe("ProgressiveStatusBar", () => {
  it("marks earlier forward stages as past with a check and the current without one", () => {
    renderBar({ current: "contacted" })

    expect(screen.getByText("New").querySelector("svg")).toBeTruthy()
    expect(screen.getByText("Contacted").querySelector("svg")).toBeFalsy()
    expect(screen.getByText("Qualified").querySelector("svg")).toBeFalsy()
    expect(screen.getByText("Converted").querySelector("svg")).toBeFalsy()
  })

  it("styles the current outcome and leaves inactive outcomes without a check", () => {
    renderBar({ current: "lost" })

    expect(screen.getByText("Lost").className).toContain("bg-gray-100")
    expect(screen.getByText("Won").className).toContain("bg-transparent")
    expect(screen.getByText("New").querySelector("svg")).toBeFalsy()
    expect(screen.getByText("Lost").querySelector("svg")).toBeFalsy()
  })

  it("marks the forward path as past when the current status is a success outcome", () => {
    renderBar({ current: "won", successOutcomes: ["won"] })

    expect(screen.getByText("New").querySelector("svg")).toBeTruthy()
    expect(screen.getByText("Contacted").querySelector("svg")).toBeTruthy()
    expect(screen.getByText("Qualified").querySelector("svg")).toBeTruthy()
    expect(screen.getByText("Converted").querySelector("svg")).toBeTruthy()
    expect(screen.getByText("Won").className).toContain("bg-emerald-100")
  })

  it("does not call onChange for disabled statuses", () => {
    const { onChange } = renderBar({
      current: "new",
      disabledStatuses: ["contacted"],
    })

    fireEvent.click(screen.getByText("Contacted"))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("Qualified"))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("qualified")
  })

  it("does not call onChange when the bar is fully disabled", () => {
    const { onChange } = renderBar({ disabled: true })

    fireEvent.click(screen.getByText("Qualified"))
    fireEvent.click(screen.getByText("Lost"))
    expect(onChange).not.toHaveBeenCalled()
  })
})
