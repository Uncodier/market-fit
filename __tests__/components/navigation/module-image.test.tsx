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
})
