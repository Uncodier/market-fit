import { render, screen } from "@testing-library/react"
import { SessionEventsChart } from "@/app/components/dashboard/traffic/session-events-chart"
import { SessionEventsReferrers } from "@/app/components/dashboard/traffic/session-events-referrers"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
const filters = { siteId: "site-a", startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29) }

it("uses the same Sessions card and plot frame for loading and empty content", () => {
  const { container, rerender } = render(<SessionEventsChart {...filters} data={[]} loading />)
  const panel = container.querySelector('[data-report-panel="sessions-trend"]')!
  const plotClass = 'h-[320px] min-w-0 w-full sm:h-[360px]'
  expect(panel).toHaveAttribute("aria-busy", "true")
  expect(container.querySelector('[class="' + plotClass + '"]')).toBeInTheDocument()
  expect(screen.queryByText("0")).not.toBeInTheDocument()
  rerender(<SessionEventsChart {...filters} data={[]} loading={false} />)
  expect(container.querySelector('[data-report-panel="sessions-trend"]')).toBe(panel)
  expect(container.querySelector('[class="' + plotClass + '"]')).toBeInTheDocument()
  expect(screen.getByText("No Events Found")).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

it("does not present an error as a zero total or a completed report", () => {
  render(<SessionEventsChart {...filters} data={[]} error="Request failed" loading={false} />)
  expect(screen.getByRole("alert")).toHaveTextContent("Request failed")
  expect(screen.queryByText("0")).not.toBeInTheDocument()
})

it("retains the referrers header and stretchable card throughout loading", () => {
  const { container, rerender } = render(<SessionEventsReferrers {...filters} data={[]} loading />)
  const card = container.firstChild
  expect(card).toHaveClass("h-full", "min-w-0", "flex-col")
  expect(screen.getByRole("heading", { name: "Top Referrers" })).toBeInTheDocument()
  rerender(<SessionEventsReferrers {...filters} data={[]} loading={false} />)
  expect(container.firstChild).toBe(card)
  expect(screen.getByText("No Referrers Found")).toBeInTheDocument()
})