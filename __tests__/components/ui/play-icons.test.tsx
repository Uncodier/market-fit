import { fireEvent, render } from "@testing-library/react"
import { MicroPlay, Play } from "@/app/components/ui/icons"

describe.each([
  { name: "Play", Icon: Play, defaultSize: 18 },
  { name: "MicroPlay", Icon: MicroPlay, defaultSize: 12 },
])("$name", ({ Icon, defaultSize }) => {
  it("visually centers the triangle within its viewport", () => {
    const { container } = render(<Icon />)
    const svg = container.querySelector("svg")!
    const triangle = svg.querySelector("polygon, path")!
    const coordinates = (
      triangle.getAttribute("points") ?? triangle.getAttribute("d")!
    ).match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const [x, y, width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number)
    const centerX = (coordinates[0] + coordinates[2] + coordinates[4]) / 3
    const centerY = (coordinates[1] + coordinates[3] + coordinates[5]) / 3

    // A triangle's visual weight sits left of its bounding-box center.
    expect(Math.abs(centerX - (x + width / 2)) / width).toBeLessThan(0.02)
    expect(centerY).toBe(y + height / 2)
    expect(Math.min(coordinates[0], coordinates[2], coordinates[4])).toBeGreaterThan(x)
    expect(Math.max(coordinates[0], coordinates[2], coordinates[4])).toBeLessThan(x + width)
  })

  it("preserves default sizing and decorative semantics", () => {
    const { container } = render(<Icon />)

    expect(container.firstChild).toHaveStyle({
      width: `${defaultSize}px`,
      height: `${defaultSize}px`,
    })
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true")
  })

  it("preserves custom sizing, color and click handling", () => {
    const onClick = jest.fn()
    const { container } = render(
      <Icon size={10} className="text-green-600" onClick={onClick} />,
    )
    const icon = container.firstElementChild!

    expect(icon).toHaveStyle({ width: "10px", height: "10px" })
    expect(icon).toHaveClass("text-green-600")
    fireEvent.click(icon)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})