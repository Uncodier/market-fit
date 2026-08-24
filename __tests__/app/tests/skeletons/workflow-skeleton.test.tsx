import { render } from "@testing-library/react"
import { WorkflowSkeleton } from "@/app/components/skeletons/workflow-skeleton"

describe("WorkflowSkeleton", () => {
  it("renders a dotted canvas with a trigger and two step cards", () => {
    const { container } = render(<WorkflowSkeleton />)
    const cards = container.querySelectorAll(".rounded-3xl.p-5")
    const paths = container.querySelectorAll("path")
    expect(cards.length).toBe(3)
    expect(paths.length).toBe(2)
  })
})
