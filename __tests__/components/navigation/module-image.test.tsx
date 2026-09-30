import { render, screen } from "@testing-library/react"
import { ModuleImage } from "@/app/components/navigation/ModuleImage"

describe("ModuleImage", () => {
  it.each([
    ["assets", "/images/modules/makinari-2026-09-30/assets.webp"],
    ["promotions", "/api/public/image/prompt/"],
  ])("keeps the shared %s icon source when the active site changes", (itemKey, expectedPath) => {
    try {
      document.cookie = "mf_current_site_id=00000000-0000-4000-8000-000000000001; Path=/"
      const { rerender } = render(
        <ModuleImage area="marketing" itemKey={itemKey} title="Module" />,
      )
      const source = screen.getByRole("img", { name: "Module app icon" }).getAttribute("src")!
      const url = new URL(source, window.location.origin)
      expect(url.pathname).toContain(expectedPath)
      expect(url.searchParams.has("site_id")).toBe(false)

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
