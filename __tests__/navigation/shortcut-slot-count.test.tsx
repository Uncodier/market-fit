import { act, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { calculateShortcutSlots, useShortcutSlotCount } from "@/app/components/navigation/use-shortcut-slot-count"

let mockMobile = false
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => mockMobile }))

it.each([[0, 0], [77, 0], [78, 1], [122, 2], [254, 5], [474, 10]])(
  "fits %s available pixels into %s complete rows", (height, expected) => {
    expect(calculateShortcutSlots(height, 38)).toBe(expected)
  },
)

it("reserves the smaller separator when overview is absent", () => {
  expect(calculateShortcutSlots(105, 22)).toBe(1)
  expect(calculateShortcutSlots(106, 22)).toBe(2)
})

function Fixture({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const slots = useShortcutSlotCount(ref, 38, isCollapsed)
  return <div data-sidebar-shortcut-viewport>
    <div data-sidebar-shortcut-content style={{ paddingBottom: 20 }}>
      <div><div ref={ref}><output>{slots}</output></div></div>
    </div>
  </div>
}

it("remeasures when the viewport or reserved footer space changes", () => {
  let resized = () => {}
  const originalObserver = global.ResizeObserver
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resized = () => callback([], this) }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
  mockMobile = false
  try {
    const { container } = render(<Fixture />)
    const viewport = container.querySelector("[data-sidebar-shortcut-viewport]")!
    const shortcuts = container.querySelector("output")!.parentElement!
    let height = 400
    Object.defineProperty(viewport, "clientHeight", { get: () => height })
    jest.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect)
    jest.spyOn(shortcuts, "getBoundingClientRect").mockReturnValue({ top: 220 } as DOMRect)
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent("5")
    height = 244
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent("1")
    height = 150
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent("0")
  } finally { global.ResizeObserver = originalObserver }
})

it("keeps the complete shortcut list available in the scrolling mobile menu", () => {
  mockMobile = true
  render(<Fixture />)
  expect(screen.getByRole("status")).toHaveTextContent(String(Number.MAX_SAFE_INTEGER))
  mockMobile = false
})

it("recalculates the expanded menu using 40px rows and its actual available height", () => {
  const originalObserver = global.ResizeObserver
  const observe = jest.fn()
  let resized = () => {}
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resized = () => callback([], this) }
    observe = observe
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
  mockMobile = false
  try {
    const { container, rerender } = render(<Fixture isCollapsed />)
    const viewport = container.querySelector("[data-sidebar-shortcut-viewport]")!
    const shortcuts = container.querySelector("output")!.parentElement!
    let height = 600
    Object.defineProperty(viewport, "clientHeight", { get: () => height })
    jest.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect)
    jest.spyOn(shortcuts, "getBoundingClientRect").mockReturnValue({ top: 220 } as DOMRect)
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent("9")
    observe.mockClear()
    height = 450 // Expanded widgets reserve more vertical space.
    rerender(<Fixture isCollapsed={false} />)
    expect(observe).toHaveBeenCalled()
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent("6")
    height = 710
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent("12")
  } finally { global.ResizeObserver = originalObserver }
})