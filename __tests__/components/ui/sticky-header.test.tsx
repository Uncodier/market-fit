import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { Button } from "@/app/components/ui/button"
import { Pencil } from "@/app/components/ui/icons"
import { ToolbarActionGroup, ToolbarActionGroups } from "@/app/components/ui/toolbar-action-groups"

jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn() }))
jest.mock("@/app/context/LayoutContext", () => ({
  useLayout: () => ({ isLayoutCollapsed: false }),
}))
jest.mock("@/app/hooks/use-command-k", () => ({ useCommandK: jest.fn() }))

function renderHeader() {
  render(<StickyHeader><span>Toolbar content</span></StickyHeader>)
  const header = screen.getByText("Toolbar content").closest("[data-toolbar-font]")
  if (!(header instanceof HTMLElement)) {
    throw new Error("Expected an HTML toolbar element")
  }
  return header
}

describe("StickyHeader responsive positioning", () => {
  it.each(["/leads", "/bills/example", "/catalog/example", "/sales/example", "/orders/example", "/inventory", "/purchases/requests", "/agents", "/campaigns", "/settings", "/chat", "/robots"])(
    "keeps button labels and variants by default on %s",
    pathname => {
      jest.mocked(usePathname).mockReturnValue(pathname)
      jest.mocked(useIsMobile).mockReturnValue(false)
      render(<>
        <StickyHeader>
          <Button variant="outline" size="sm">Private reports</Button>
          <Button variant="ghost"><Pencil />Edit</Button>
        </StickyHeader>
        <Button variant="ghost">Save form</Button>
      </>)
      const reports = screen.getByRole("button", { name: "Private reports" })
      expect(reports).toHaveTextContent("Private reports")
      expect(reports).toHaveClass("ring-input", "px-3")
      expect(reports).not.toHaveClass("!w-10")
      const edit = screen.getByRole("button", { name: "Edit" })
      expect(edit).toHaveTextContent("Edit")
      expect(edit.querySelector("svg")).toBeInTheDocument()
      expect(edit.closest("[data-automatic-toolbar-tooltip]")).toBeNull()
      expect(screen.getByRole("button", { name: "Save form" })).toHaveTextContent("Save form")
    },
  )

  it("still renders explicit contextual groups as icon toolbars beside labeled actions", () => {
    render(<StickyHeader>
      <ToolbarActionGroups>
        <ToolbarActionGroup label="Document actions">
          <Button variant="ghost"><Pencil />Edit document</Button>
          <Button variant="outline">View approval history</Button>
        </ToolbarActionGroup>
      </ToolbarActionGroups>
      <Button variant="outline"><Pencil />Edit settings</Button>
    </StickyHeader>)

    const action = screen.getByRole("button", { name: "Edit document" })
    expect(action).toHaveClass("!w-10", "!h-10")
    expect(action).not.toHaveTextContent("Edit document")
    expect(action.closest("[data-automatic-toolbar-tooltip]")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View approval history" })).toHaveTextContent("View approval history")
    expect(screen.getByRole("button", { name: "Edit settings" })).toHaveTextContent("Edit settings")
  })

  it.each(["/leads", "/robots", "/chat", "/people"])(
    "keeps the mobile toolbar in normal flow on %s",
    (pathname) => {
      jest.mocked(usePathname).mockReturnValue(pathname)
      jest.mocked(useIsMobile).mockReturnValue(true)

      const header = renderHeader()

      expect(header).toHaveClass("static")
      expect(header).not.toHaveClass("sticky", "fixed")
      expect(header).not.toHaveStyle({ paddingLeft: "256px" })
      expect(header.style.left).toBe("")
      expect(header.style.right).toBe("")
    },
  )

  it("preserves sticky positioning on regular desktop pages", () => {
    jest.mocked(usePathname).mockReturnValue("/leads")
    jest.mocked(useIsMobile).mockReturnValue(false)

    expect(renderHeader()).toHaveClass("md:sticky")
  })

  it.each(["/robots", "/chat", "/people"])(
    "preserves fixed positioning on desktop %s",
    (pathname) => {
      jest.mocked(usePathname).mockReturnValue(pathname)
      jest.mocked(useIsMobile).mockReturnValue(false)

      expect(renderHeader()).toHaveClass("md:fixed")
    },
  )
})