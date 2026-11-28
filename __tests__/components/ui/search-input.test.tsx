import { act, fireEvent, render, screen } from "@testing-library/react"
import { SearchInput } from "@/app/components/ui/search-input"

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

describe("SearchInput animation state", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("reports entry immediately and exit after the blur grace period", () => {
    jest.useFakeTimers()
    const onExpandedChange = jest.fn()

    render(
      <SearchInput
        placeholder="Search catalog..."
        value=""
        containerClassName="w-full"
        onExpandedChange={onExpandedChange}
        onChange={jest.fn()}
      />,
    )

    const input = screen.getByPlaceholderText("Search catalog...")
    const container = input.parentElement?.parentElement?.parentElement

    fireEvent.click(screen.getByRole("button", { name: "Search catalog..." }))

    expect(onExpandedChange).toHaveBeenLastCalledWith(true)
    expect(container).toHaveClass("w-full", "h-11")
    expect(input).toHaveClass("h-11")

    fireEvent.blur(input)
    act(() => {
      jest.advanceTimersByTime(150)
    })

    expect(onExpandedChange).toHaveBeenLastCalledWith(false)
    expect(container).toHaveClass("w-10", "h-10")
  })

  it("reserves the full toolbar button size without flex shrinking", () => {
    render(
      <div data-toolbar-icon-actions="">
        <SearchInput placeholder="Search leads..." value="" onChange={jest.fn()} />
      </div>,
    )

    const button = screen.getByRole("button", { name: "Search leads..." })
    const collapsed = button.closest("[data-toolbar-tooltip-trigger]")?.parentElement

    expect(button).toHaveClass("h-10", "w-10")
    expect(collapsed).toHaveClass("h-10", "w-10", "top-1/2", "-translate-y-1/2")
    expect(collapsed?.parentElement).toHaveClass("h-10", "w-10", "shrink-0")
  })

  it("reserves the full height of the expanded search in the mobile drawer", () => {
    render(<SearchInput placeholder="Search leads..." alwaysExpanded expandedHeightClassName="h-12" />)

    const input = screen.getByPlaceholderText("Search leads...")
    const expanded = input.parentElement?.parentElement
    for (const element of [input, expanded, expanded?.parentElement]) {
      expect(element).toHaveClass("h-12")
    }
  })

  it("keeps the clear control inside the expanded input in a toolbar", () => {
    const onSearch = jest.fn()
    render(
      <div data-toolbar-icon-actions="">
        <SearchInput placeholder="Search leads..." value="Acme" onSearch={onSearch} />
      </div>,
    )

    const clear = screen.getByRole("button", { name: "Clear search" })
    expect(clear).toHaveAttribute("data-toolbar-icon-action", "off")
    expect(clear).toHaveClass("h-7", "w-7")
    expect(clear).not.toHaveClass("h-10", "w-10")
    expect(clear.parentElement).not.toHaveAttribute("data-automatic-toolbar-tooltip")

    fireEvent.click(clear)
    expect(onSearch).toHaveBeenCalledWith("")
  })
})
