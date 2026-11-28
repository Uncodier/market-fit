import { fireEvent, render, screen, within } from "@testing-library/react"
import { FilterContainer, FilterSection, MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Download } from "@/app/components/ui/icons"
import { useIsMobile } from "@/app/hooks/use-mobile-view"

jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "Filters" }) }))

it.each([false, true])("keeps toolbar zones in keyboard order (mobile: %s)", mobile => {
  jest.mocked(useIsMobile).mockReturnValue(mobile)
  const onExport = jest.fn()
  render(<MobileFiltersDrawer actions={<ToolbarIconButton label="Export" onClick={onExport}><Download /></ToolbarIconButton>}
    controls={<button>Views</button>}>
    <FilterContainer>
      <FilterSection title="Status"><button>Status</button></FilterSection>
      <FilterSection zone="tabs"><button>All items</button></FilterSection>
      <FilterSection zone="search" desktopOnly><SearchInput placeholder="Search items" /></FilterSection>
    </FilterContainer>
  </MobileFiltersDrawer>)
  const search = screen.getByRole("button", { name: "Search items" }).closest("[data-toolbar-search]")!
  const tabs = screen.getByRole("button", { name: "All items" }).closest("[data-toolbar-zone='tabs']")!
  const exportButton = screen.getByRole("button", { name: "Export" })
  const actions = exportButton.closest("[data-toolbar-actions]")!
  const view = actions.nextElementSibling!
  expect(tabs.previousElementSibling).toBeNull()
  expect(tabs.nextElementSibling).toBe(actions)
  expect(actions).toHaveAttribute("data-toolbar-zone", "tools")
  expect(view).toHaveAttribute("data-toolbar-zone", "view")
  expect(view.firstElementChild).toBe(search)
  expect(view).toContainElement(screen.getByRole("button", { name: "Views" }))
  fireEvent.click(exportButton)
  expect(onExport).toHaveBeenCalledTimes(1)

  if (mobile) {
    const filters = screen.getByRole("button", { name: "Filters" })
    expect(search.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(filters)
    const drawer = within(screen.getByRole("dialog", { name: "Filters" }))
    expect(drawer.getByRole("button", { name: "Status" })).toBeInTheDocument()
    expect(drawer.queryByRole("button", { name: "All items" })).not.toBeInTheDocument()
    expect(drawer.queryByPlaceholderText("Search items")).not.toBeInTheDocument()
  } else {
    const status = screen.getByRole("button", { name: "Status" })
    expect(view).toContainElement(status)
    expect(search.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
})