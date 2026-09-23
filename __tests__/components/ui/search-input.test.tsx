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

    fireEvent.click(screen.getByTitle("Search catalog..."))

    expect(onExpandedChange).toHaveBeenLastCalledWith(true)
    expect(container).toHaveClass("w-full")

    fireEvent.blur(input)
    act(() => {
      jest.advanceTimersByTime(150)
    })

    expect(onExpandedChange).toHaveBeenLastCalledWith(false)
    expect(container).toHaveClass("w-9", "h-9")
  })
})
