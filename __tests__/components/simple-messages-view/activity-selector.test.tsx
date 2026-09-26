import { render, screen } from "@testing-library/react"
import { ActivitySelector } from "@/app/components/simple-messages-view/components/ActivitySelector"

describe("activity selector trigger sizing", () => {
  it("lets Ask hug its icon and label instead of reserving the wide activity width", () => {
    render(<ActivitySelector selectedActivity="ask" onActivityChange={jest.fn()} />)
    const askButton = screen.getByRole("button", { name: "Ask" })
    expect(askButton).toHaveClass("w-auto")
    expect(askButton).not.toHaveClass("md:w-40")
    expect(askButton).toHaveTextContent("Ask")
  })

  it("preserves the existing width for other activities", () => {
    render(<ActivitySelector selectedActivity="plan" onActivityChange={jest.fn()} />)
    expect(screen.getByRole("button", { name: "Plan" })).toHaveClass("md:w-40")
  })
})
