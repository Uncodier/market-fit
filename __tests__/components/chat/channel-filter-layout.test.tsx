import { render, screen } from "@testing-library/react"
import { ChannelFilter } from "@/app/components/chat/ChannelFilter"

test("the conversation tabs scroll with the list on mobile and stick on desktop", () => {
  const { container } = render(<ChannelFilter selectedFilter="all" onFilterChange={jest.fn()} />)

  expect(screen.getByRole("tablist")).toBeInTheDocument()
  const toolbar = container.firstElementChild
  expect(toolbar).not.toHaveClass("sticky")
  expect(toolbar).not.toHaveClass("fixed")
  expect(toolbar).toHaveClass("md:sticky", "md:top-0")
})