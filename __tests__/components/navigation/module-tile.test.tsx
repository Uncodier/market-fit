import { fireEvent, render, screen } from "@testing-library/react"
import { ModuleTile } from "@/app/components/navigation/ModuleTile"

describe("ModuleTile sidebar shortcut highlighting", () => {
  it("keeps shortcut cards neutral on mobile and highlights them only on desktop", () => {
    render(<ModuleTile area="marketing" itemKey="campaigns" title="Campaigns" inMenu onClick={jest.fn()} />)

    const tile = screen.getByRole("button", { name: /Campaigns/ })
    expect(tile.firstElementChild).toHaveClass(
      "border-transparent", "bg-transparent",
      "md:bg-black/[0.05]", "md:dark:bg-white/[0.07]",
      "md:border-black/12", "md:dark:border-white/14",
    )
    expect(tile.firstElementChild).not.toHaveClass("bg-black/[0.05]", "dark:bg-white/[0.07]")
    expect(screen.getByText("Campaigns")).toHaveClass(
      "font-medium", "text-muted-foreground", "md:font-semibold", "md:text-foreground/80",
    )
  })

  it("does not highlight cards that are not sidebar shortcuts", () => {
    render(<ModuleTile area="sales" itemKey="accountsReceivable" title="Accounts Receivable" onClick={jest.fn()} />)

    const tile = screen.getByRole("button", { name: /Accounts Receivable/ })
    expect(tile.firstElementChild).toHaveClass("border-transparent", "bg-transparent")
    expect(tile.firstElementChild).not.toHaveClass("md:bg-black/[0.05]", "md:dark:bg-white/[0.07]")
  })

  it("preserves mouse and keyboard navigation for sidebar shortcuts", () => {
    const onClick = jest.fn()
    render(<ModuleTile area="marketing" itemKey="campaigns" title="Campaigns" inMenu onClick={onClick} />)

    const tile = screen.getByRole("button", { name: /Campaigns/ })
    fireEvent.click(tile)
    fireEvent.keyDown(tile, { key: "Enter" })
    fireEvent.keyDown(tile, { key: " " })
    fireEvent.keyDown(tile, { key: "Escape" })
    expect(onClick).toHaveBeenCalledTimes(3)
  })
})