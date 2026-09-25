import { render, screen } from "@testing-library/react"
import { ModuleImage } from "@/app/components/navigation/ModuleImage"

describe("ModuleImage", () => {
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
