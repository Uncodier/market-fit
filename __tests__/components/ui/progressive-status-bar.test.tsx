import { fireEvent, render, screen, within } from "@testing-library/react"
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
  // jsdom does not apply Tailwind media queries, so both responsive views exist.
  const desktop = result.container.querySelector<HTMLElement>('.hidden.md\\:flex')!
  const mobile = result.container.querySelector<HTMLElement>('.md\\:hidden')!
  expect(desktop).toBeInTheDocument()
  expect(mobile).toBeInTheDocument()
  return { ...result, onChange, desktop: within(desktop), mobile: within(mobile) }
}

describe("ProgressiveStatusBar", () => {
  it("marks earlier forward stages as past with a check and the current without one", () => {
    const { desktop } = renderBar({ current: "contacted" })

    expect(desktop.getByText("New").querySelector("svg")).toBeTruthy()
    expect(desktop.getByText("Contacted").querySelector("svg")).toBeFalsy()
    expect(desktop.getByText("Qualified").querySelector("svg")).toBeFalsy()
    expect(desktop.getByText("Converted").querySelector("svg")).toBeFalsy()
  })

  it("styles the current outcome and leaves inactive outcomes without a check", () => {
    const { desktop } = renderBar({ current: "lost" })

    expect(desktop.getByText("Lost").className).toContain("bg-gray-100")
    expect(desktop.getByText("Won").className).toContain("bg-transparent")
    expect(desktop.getByText("New").querySelector("svg")).toBeFalsy()
    expect(desktop.getByText("Lost").querySelector("svg")).toBeFalsy()
  })

  it("marks the forward path as past when the current status is a success outcome", () => {
    const { desktop } = renderBar({ current: "won", successOutcomes: ["won"] })

    expect(desktop.getByText("New").querySelector("svg")).toBeTruthy()
    expect(desktop.getByText("Contacted").querySelector("svg")).toBeTruthy()
    expect(desktop.getByText("Qualified").querySelector("svg")).toBeTruthy()
    expect(desktop.getByText("Converted").querySelector("svg")).toBeTruthy()
    expect(desktop.getByText("Won").className).toContain("bg-emerald-100")
  })

  it("does not call onChange for disabled statuses", () => {
    const { onChange, desktop } = renderBar({
      current: "new",
      disabledStatuses: ["contacted"],
    })

    fireEvent.click(desktop.getByText("Contacted"))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(desktop.getByText("Qualified"))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("qualified")
  })

  it("does not call onChange when the bar is fully disabled", () => {
    const { onChange, desktop } = renderBar({ disabled: true })

    fireEvent.click(desktop.getByText("Qualified"))
    fireEvent.click(desktop.getByText("Lost"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not reselect the current status', () => {
    const { onChange, desktop } = renderBar()
    fireEvent.click(desktop.getByText('Contacted'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('enforces disabled statuses and selects enabled outcomes in the mobile menu', () => {
    const { onChange, mobile } = renderBar({ disabledStatuses: ['qualified'] })
    fireEvent.keyDown(mobile.getByText('Contacted'), { key: 'Enter' })
    const qualified = screen.getByRole('menuitem', { name: 'Qualified' })
    expect(qualified).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(qualified)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Won' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('won')
  })
})
