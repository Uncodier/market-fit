import { fireEvent, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { PosAlphabetIndex } from "@/app/pos/components/PosAlphabetIndex"

describe("POS mobile layout", () => {
  it("centers the alphabet rail inside the visible catalog area", () => {
    const onSelect = jest.fn()

    render(<PosAlphabetIndex letters={["A", "B"]} onSelect={onSelect} />)

    const rail = screen.getByRole("navigation", {
      name: "Catalog alphabet index",
    })

    expect(rail.parentElement).toHaveClass(
      "fixed",
      "bottom-0",
      "top-[calc(var(--topbar-height,64px)+71px)]",
      "items-center",
    )
    expect(rail).toHaveClass("h-[64%]")

    fireEvent.click(screen.getByRole("button", { name: /starting with B/ }))
    expect(onSelect).toHaveBeenCalledWith("B")
  })

  it.each([
    "PosOptionsDialog.tsx",
    "PosVariantPickerDialog.tsx",
    "PosModifierPickerDialog.tsx",
  ])("hides the redundant footer cancel action on mobile in %s", (fileName) => {
    const source = readFileSync(
      path.join(process.cwd(), "app/pos/components", fileName),
      "utf8",
    )

    expect(source).toMatch(
      /className="hidden md:inline-flex"[\s\S]*?\{t\("common\.cancel"\) \|\| "Cancel"\}/,
    )
  })
})
