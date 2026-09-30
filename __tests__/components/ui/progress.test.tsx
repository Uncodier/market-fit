import React from "react"
import { render, screen } from "@testing-library/react"
import { Progress } from "@/app/components/ui/progress"

describe("Progress", () => {
  it("preserves the default single indicator", () => {
    render(<Progress value={35} aria-label="Usage" indicatorClassName="bg-amber-500" />)

    const progress = screen.getByRole("progressbar", { name: "Usage" })
    expect(progress).toHaveAttribute("aria-valuenow", "35")
    expect(progress.children).toHaveLength(1)
    expect(progress.firstElementChild).toHaveClass("bg-amber-500")
    expect(progress.firstElementChild).toHaveStyle({ transform: "translateX(-65%)" })
  })

  it("renders adjacent, independently colored segments in one track", () => {
    render(<Progress
      value={60}
      aria-label="Balance"
      segments={[
        { label: "Regular", value: 20, className: "bg-primary" },
        { label: "Withdrawable", value: 40, className: "bg-emerald-500" },
      ]}
    />)

    const progress = screen.getByRole("progressbar", { name: "Balance" })
    expect(progress).toHaveClass("flex")
    expect(progress).toHaveAttribute("aria-valuenow", "60")
    expect(screen.getByTitle("Regular")).toHaveStyle({ width: "20%" })
    expect(screen.getByTitle("Withdrawable")).toHaveStyle({ width: "40%" })
    expect(screen.getByTitle("Withdrawable")).toHaveClass("bg-emerald-500", "shrink-0")
  })
})