import { act, render, screen } from "@testing-library/react"
import { ReportChartFrame } from "@/app/components/dashboard/report-chart-frame"
import { ReportLoading } from "@/app/dashboard/ReportLoading"

let resize: ResizeObserverCallback
let top = 420
const observe = jest.fn()
const disconnect = jest.fn()
const originalObserver = global.ResizeObserver

beforeEach(() => {
  jest.useFakeTimers()
  top = 420
  observe.mockClear()
  disconnect.mockClear()
  global.ResizeObserver = jest.fn(callback => {
    resize = callback
    return { observe, disconnect, unobserve: jest.fn() }
  }) as unknown as typeof ResizeObserver
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const y = this.hasAttribute("data-report-chart") ? top : 0
    return { top: y, bottom: y + 300, height: 300, width: 800, left: 0, right: 800, x: 0, y, toJSON: () => ({}) }
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
  global.ResizeObserver = originalObserver
})

function report() {
  return render(<main data-testid="scroll">
    <header data-testid="bars">Navigation and filters</header>
    <div data-report-viewport style={{ paddingBottom: 24 }}>
      <div data-testid="widgets">Summary widgets</div>
      <ReportChartFrame data-testid="plot" className="h-[300px] sm:h-[360px]">Chart</ReportChartFrame>
    </div>
  </main>)
}

it("subtracts the measured layout and reserves an additional 71px below the plot", () => {
  report()
  expect(screen.getByTestId("plot").style.minHeight).toBe("max(0px, calc(100dvh - 515px))")
  expect(screen.getByTestId("plot")).toHaveClass("h-[300px]", "sm:h-[360px]")
  expect(observe).toHaveBeenCalledWith(screen.getByTestId("widgets"))
  expect(observe).toHaveBeenCalledWith(screen.getByTestId("bars"))
})

it("remeasures when wrapping widgets or filters change size and on window resize", () => {
  report()
  top = 520
  act(() => { resize([], {} as ResizeObserver); jest.runOnlyPendingTimers() })
  expect(screen.getByTestId("plot").style.minHeight).toBe("max(0px, calc(100dvh - 615px))")
  top = 320
  act(() => { window.dispatchEvent(new Event("resize")); jest.runOnlyPendingTimers() })
  expect(screen.getByTestId("plot").style.minHeight).toBe("max(0px, calc(100dvh - 415px))")
})

it("does not grow charts when the report is already scrolled", () => {
  report()
  screen.getByTestId("scroll").scrollTop = 120
  top -= 120
  jest.replaceProperty(window, "scrollY", 80)
  top -= 80
  act(() => { resize([], {} as ResizeObserver); jest.runOnlyPendingTimers() })
  expect(screen.getByTestId("plot").style.minHeight).toBe("max(0px, calc(100dvh - 515px))")
})

it("preserves standalone chart sizes and avoids double measurement of nested frames", () => {
  const { rerender } = render(<ReportChartFrame data-testid="standalone">Chart</ReportChartFrame>)
  expect(screen.getByTestId("standalone").style.minHeight).toBe("")
  expect(observe).not.toHaveBeenCalled()
  rerender(<div data-report-viewport>
    <ReportChartFrame data-testid="outer" minimumHeight={360}>
      <ReportChartFrame data-testid="inner">Chart</ReportChartFrame>
    </ReportChartFrame>
    <ReportChartFrame data-testid="table" enabled={false}>Table</ReportChartFrame>
  </div>)
  expect(screen.getByTestId("outer").style.minHeight).toBe("max(360px, calc(100dvh - 491px))")
  expect(screen.getByTestId("inner").style.minHeight).toBe("")
  expect(screen.getByTestId("table").style.minHeight).toBe("")
  expect(screen.getByTestId("table")).not.toHaveAttribute("data-report-chart")
})

it("disconnects observers and cancels queued measurements on section unmount", () => {
  const { unmount } = report()
  act(() => { resize([], {} as ResizeObserver) })
  expect(jest.getTimerCount()).toBeGreaterThan(0)
  unmount()
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it("still responds to window resizing when ResizeObserver is unavailable", () => {
  global.ResizeObserver = undefined as unknown as typeof ResizeObserver
  report()
  top = 620
  act(() => { window.dispatchEvent(new Event("resize")); jest.runOnlyPendingTimers() })
  expect(screen.getByTestId("plot").style.minHeight).toBe("max(0px, calc(100dvh - 715px))")
})

it("leaves compact attribution placeholders at their natural height", () => {
  const { container } = render(<div data-report-viewport><ReportLoading report="analytics" section="distribution" /></div>)
  expect(container.querySelectorAll("[data-loading-plot]")).toHaveLength(4)
  expect(container.querySelector("[data-report-chart]")).not.toBeInTheDocument()
})

it.each([
  ["performance", "outcomes"], ["overview", "summary"], ["overview", "economics"],
  ["sales", "channels"], ["costs", "summary"], ["social", "summary"], ["traffic", "sessions"],
] as const)("uses viewport-aware plots in the %s/%s loading shell", (report, section) => {
  const { container } = render(<div data-report-viewport style={{ paddingBottom: 24 }}>
    <ReportLoading report={report} section={section} />
  </div>)
  const plots = container.querySelectorAll<HTMLElement>("[data-loading-plot]")
  expect(plots.length).toBeGreaterThan(0)
  for (const plot of plots) expect(plot.style.minHeight).toBe("max(0px, calc(100dvh - 515px))")
})