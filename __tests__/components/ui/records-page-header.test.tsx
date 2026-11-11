import { fireEvent, render, screen } from "@testing-library/react"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { RecordsPageHeader } from "@/app/records/components/RecordsPageHeader"

jest.mock("@/app/context/LayoutContext", () => ({
  useLayout: () => ({ isLayoutCollapsed: false }),
}))
jest.mock("@/app/hooks/use-command-k", () => ({ useCommandK: jest.fn() }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn(() => false) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

describe("records page header", () => {
  it.each([false, true])("always renders the toolbar when mobile is %s", (isMobile) => {
    jest.mocked(useIsMobile).mockReturnValue(isMobile)
    const { container } = render(
      <RecordsPageHeader isMobile={isMobile} isSidebarCollapsed={false}
        toggleSidebar={jest.fn()} sidebarLeft="256px">
        <input aria-label="Search records" />
      </RecordsPageHeader>
    )

    expect(screen.getByRole("textbox", { name: "Search records" })).toBeVisible()
    expect(container.firstElementChild).toHaveClass(isMobile ? "sticky" : "fixed")
    expect(screen.queryByRole("button", { name: /record toolbar/i })).not.toBeInTheDocument()
  })

  it("preserves the desktop category sidebar toggle without hiding the toolbar", () => {
    jest.mocked(useIsMobile).mockReturnValue(false)
    const toggleSidebar = jest.fn()
    render(
      <RecordsPageHeader isMobile={false} isSidebarCollapsed={false}
        toggleSidebar={toggleSidebar} sidebarLeft="64px">
        <input aria-label="Search records" />
      </RecordsPageHeader>
    )

    fireEvent.click(screen.getByRole("button", { name: "Hide categories" }))
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("textbox", { name: "Search records" })).toBeVisible()
  })
})