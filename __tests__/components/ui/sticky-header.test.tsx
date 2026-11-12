import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useIsMobile } from "@/app/hooks/use-mobile-view"

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