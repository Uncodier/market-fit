import { createPortal } from "react-dom"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { stickyHeaderSelectClassName } from "@/app/components/ui/sticky-header-styles"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Tabs } from "@/app/components/ui/tabs"
import { DashboardFilters } from "@/app/dashboard/DashboardFilters"

jest.mock("@/app/context/LayoutContext", () => ({
  useLayout: () => ({ isLayoutCollapsed: false }),
}))
jest.mock("@/app/hooks/use-command-k", () => ({ useCommandK: jest.fn() }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "user-one" }, isLoading: false }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-one" }, isLoading: false }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn(() => false) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: "en" }),
}))

function SegmentSelect({
  label = "Segment", disabled = false, onChange = jest.fn(),
}: { label?: string; disabled?: boolean; onChange?: (value: string) => void }) {
  return (
    <Select defaultValue="all" onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className="w-full md:w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All segments</SelectItem>
        <SelectItem value="active">Active customers</SelectItem>
      </SelectContent>
    </Select>
  )
}

function getStyleScope(element: Element) {
  const scopeClass = stickyHeaderSelectClassName.split(" ")[0]
  let parent = element.parentElement
  while (parent && !parent.classList.contains(scopeClass)) parent = parent.parentElement
  return parent
}

describe("sticky header select styling", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true, value: jest.fn(),
    })
  })
  beforeEach(() => {
    jest.mocked(useIsMobile).mockReturnValue(false)
    jest.mocked(usePathname).mockReturnValue("/dashboard")
  })
  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
  })

  it.each([
    ["/dashboard", "sticky"],
    ["/chat", "fixed"],
    ["/robots", "fixed"],
    ["/people", "fixed"],
  ])("keeps %s out of Safari's select positioning rules", (pathname, position) => {
    jest.mocked(usePathname).mockReturnValue(pathname)
    const { container } = render(<StickyHeader><SegmentSelect /></StickyHeader>)
    const header = container.querySelector("[data-toolbar-font]")!

    expect(header).toHaveClass(position, "top-[var(--topbar-height,64px)]")
    // Legacy Safari CSS uses substring selectors, including position: relative !important.
    expect(header.matches('[class*="select-trigger"]')).toBe(false)
    expect(screen.getByRole("combobox", { name: "Segment" }).matches('[class*="select-trigger"]')).toBe(true)
  })

  it.each([
    ["overview", false], ["overview", true], ["analytics", false], ["analytics", true],
  ] as const)("keeps %s export before the date picker on desktop and outside mobile filters (mobile=%s)", (report, mobile) => {
    jest.mocked(useIsMobile).mockReturnValue(mobile)
    const { container } = render(
      <Tabs defaultValue="summary">
        <DashboardFilters
          t={() => ""}
          selectedSegment="all"
          onSegmentChange={jest.fn()}
          isLoadingSegments={false}
          segments={[]}
          dateRange={{ startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29) }}
          onDateRangeChange={jest.fn()}
          report={report}
        />
      </Tabs>
    )
    const header = container.querySelector("[data-toolbar-font]")!
    expect(header).toHaveClass("min-h-[71px]")
    expect(header).not.toHaveClass("min-h-[64px]")
    const exportButton = screen.getByRole("button", { name: "Export current section (CSV)" })
    expect(exportButton.closest("[data-toolbar-font]")).toBe(header)
    expect(screen.getAllByRole("button", { name: "Export current section (CSV)" })).toHaveLength(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    if (mobile) {
      expect(exportButton.parentElement).toHaveClass("ml-auto", "flex", "shrink-0", "justify-end")
      expect(exportButton.parentElement?.lastElementChild).toBe(exportButton)
      fireEvent.click(screen.getByRole("button", { name: "Filters" }))
      expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Export current section (CSV)" })).not.toBeInTheDocument()
      expect(exportButton.closest("[data-toolbar-font]")).toBe(header)
    } else {
      expect(exportButton.parentElement).toHaveClass("flex", "md:flex-row", "md:items-center")
      expect(exportButton.parentElement?.firstElementChild).toBe(exportButton)
      const dateButton = within(exportButton.parentElement!).getAllByRole("button")[1]
      expect(dateButton).toBeInTheDocument()
      expect(exportButton.nextElementSibling).toContainElement(dateButton)
    }
  })

  it("shares the secondary filter style without changing form selects or their widths", () => {
    render(<>
      <StickyHeader><SegmentSelect /></StickyHeader>
      <SegmentSelect label="Form segment" />
    </>)

    const trigger = screen.getByRole("combobox", { name: "Segment" })
    expect(getStyleScope(trigger)).toHaveClass(...stickyHeaderSelectClassName.split(" "))
    expect(trigger).toHaveClass("w-full", "md:w-[180px]")
    const formTrigger = screen.getByRole("combobox", { name: "Form segment" })
    expect(getStyleScope(formTrigger)).toBeNull()
    expect(formTrigger).toHaveClass("h-11", "rounded-md", "border", "bg-background")
  })

  it("does not leak toolbar styles into a form portaled from the header", () => {
    render(
      <StickyHeader>
        <SegmentSelect />
        {createPortal(<SegmentSelect label="Dialog segment" />, document.body)}
      </StickyHeader>
    )
    expect(getStyleScope(screen.getByRole("combobox", { name: "Segment" }))).not.toBeNull()
    expect(getStyleScope(screen.getByRole("combobox", { name: "Dialog segment" }))).toBeNull()
  })

  it("preserves keyboard selection and keeps the option menu outside the style scope", async () => {
    const onChange = jest.fn()
    render(<StickyHeader><SegmentSelect onChange={onChange} /></StickyHeader>)
    const trigger = screen.getByRole("combobox", { name: "Segment" })
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    const option = await screen.findByRole("option", { name: "Active customers" })
    expect(getStyleScope(option)).toBeNull()
    fireEvent.keyDown(option, { key: "Enter" })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("active"))
    expect(trigger).toHaveTextContent("Active customers")
  })

  it("keeps disabled filters disabled", () => {
    render(<StickyHeader><SegmentSelect disabled /></StickyHeader>)
    const trigger = screen.getByRole("combobox", { name: "Segment" })
    expect(trigger).toBeDisabled()
    fireEvent.keyDown(trigger, { key: "ArrowDown" })
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("applies the same style inside the portaled mobile filters drawer", () => {
    jest.mocked(useIsMobile).mockReturnValue(true)
    render(
      <StickyHeader>
        <MobileFiltersDrawer triggerText="Filters"><SegmentSelect /></MobileFiltersDrawer>
      </StickyHeader>
    )
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    const trigger = screen.getByRole("combobox", { name: "Segment" })
    expect(getStyleScope(trigger)).toHaveClass("mobile-filters-drawer-content")
    expect(getStyleScope(trigger)).toHaveClass(...stickyHeaderSelectClassName.split(" "))
    expect(getStyleScope(trigger)?.matches('[class*="select-trigger"]')).toBe(false)
    expect(trigger.closest("[data-toolbar-font]")).toBeNull()
  })
})