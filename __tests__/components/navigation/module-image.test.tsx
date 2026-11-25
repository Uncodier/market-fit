import { catalogIconUrl } from "@/__tests__/fixtures/module-icon-url"
import { fireEvent, render, screen } from "@testing-library/react"
import { ModuleImage } from "@/app/components/navigation/ModuleImage"

describe("ModuleImage", () => {
  it("shows the accessible fallback without requesting an image for an unknown key", () => {
    const { container } = render(<ModuleImage area="sales" itemKey="unknown" title="New Module" />)
    expect(screen.getByRole("img", { name: "New Module app icon" }).querySelector("svg")).not.toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("selects different image URLs when the theme state changes", () => {
    const { rerender } = render(<ModuleImage key="themeLight" area="settings" itemKey="themeLight" title="Theme" />)
    expect(screen.getByRole("img", { name: "Theme app icon" })).toHaveAttribute("src", catalogIconUrl("themeLight"))
    fireEvent.error(screen.getByRole("img", { name: "Theme app icon" }))
    rerender(<ModuleImage key="themeDark" area="settings" itemKey="themeDark" title="Theme" />)
    expect(screen.getByRole("img", { name: "Theme app icon" })).toHaveAttribute("src", catalogIconUrl("themeDark"))
  })

  it("renders the shared Profile artwork and keeps a user icon on delivery failure", () => {
    render(<ModuleImage area="settings" itemKey="profile" title="Profile" />)
    const image = screen.getByRole("img", { name: "Profile app icon" })
    expect(image).toHaveAttribute("src", catalogIconUrl("profile"))
    fireEvent.error(image)
    expect(screen.getByRole("img", { name: "Profile app icon" }).querySelector("svg")).not.toBeNull()
  })

  it("renders Suppliers with contact artwork without inset padding", () => {
    const { container } = render(
      <ModuleImage area="buying" itemKey="suppliers" title="Suppliers" />,
    )
    const image = screen.getByRole("img", { name: "Suppliers app icon" })
    expect(image).toHaveAttribute("src", catalogIconUrl("leads"))
    expect(image).toHaveClass("object-cover", "dark:brightness-[0.82]", "hue-rotate-60")
    expect(image).not.toHaveClass("brightness-0", "p-2")
    expect(container.firstChild).toHaveClass("bg-muted/50")
  })

  it("preserves the original contact artwork colors", () => {
    render(<ModuleImage area="sales" itemKey="leads" title="Contacts" />)
    expect(screen.getByRole("img", { name: "Contacts app icon" })).not.toHaveClass("hue-rotate-60")
  })

  it("keeps a visible accessible icon when generated procurement artwork fails", () => {
    render(<ModuleImage area="buying" itemKey="suppliers" title="Suppliers" />)
    fireEvent.error(screen.getByRole("img", { name: "Suppliers app icon" }))
    expect(screen.getByRole("img", { name: "Suppliers app icon" }).querySelector("svg")).not.toBeNull()
  })
  it.each(["assets", "promotions"])("keeps the shared %s icon source when the active site changes", (itemKey) => {
    try {
      document.cookie = "mf_current_site_id=00000000-0000-4000-8000-000000000001; Path=/"
      const { rerender } = render(
        <ModuleImage area="marketing" itemKey={itemKey} title="Module" />,
      )
      const source = screen.getByRole("img", { name: "Module app icon" }).getAttribute("src")!
      expect(source).toEqual(catalogIconUrl(itemKey))

      document.cookie = "mf_current_site_id=00000000-0000-4000-8000-000000000002; Path=/"
      rerender(<ModuleImage area="marketing" itemKey={itemKey} title="Module" />)

      expect(screen.getByRole("img", { name: "Module app icon" })).toHaveAttribute("src", source)
    } finally {
      document.cookie = "mf_current_site_id=; Path=/; Max-Age=0"
    }
  })

  it("reduces generated icon brightness in dark mode", () => {
    render(
      <ModuleImage
        area="marketing"
        itemKey="assets"
        title="Assets"
      />,
    )

    expect(screen.getByRole("img", { name: "Assets app icon" })).toHaveClass(
      "dark:brightness-[0.82]",
    )
  })

  it("renders full-size iOS-style glyphs without a component background", () => {
    const { container } = render(
      <ModuleImage
        area="sales"
        itemKey="catalog"
        title="Catalog"
      />,
    )

    expect(container.firstChild).not.toHaveClass("bg-muted/50")
    expect(screen.getByRole("img", { name: "Catalog app icon" })).toHaveClass(
      "object-contain",
    )
  })

  it("renders Records with the full-size transparent treatment", () => {
    const { container } = render(
      <ModuleImage
        area="operations"
        itemKey="records"
        title="Records"
      />,
    )

    expect(container.firstChild).not.toHaveClass("bg-muted/50")
    expect(screen.getByRole("img", { name: "Records app icon" })).toHaveClass(
      "object-contain",
    )
  })

  it("keeps the existing crop and fallback background for standard images", () => {
    const { container } = render(
      <ModuleImage
        area="marketing"
        itemKey="assets"
        title="Assets"
      />,
    )

    expect(container.firstChild).toHaveClass("bg-muted/50")
    expect(screen.getByRole("img", { name: "Assets app icon" })).toHaveClass(
      "object-cover",
    )
  })

  it("renders Point of Sale with the full-size transparent treatment", () => {
    const { container } = render(
      <ModuleImage
        area="sales"
        itemKey="pos"
        title="Point of Sale"
      />,
    )

    expect(container.firstChild).not.toHaveClass("bg-muted/50")
    expect(
      screen.getByRole("img", { name: "Point of Sale app icon" }),
    ).toHaveClass("object-contain")
  })
})
