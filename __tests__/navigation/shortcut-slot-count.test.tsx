import { act, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { calculateShortcutSlots, useShortcutSlotCount } from "@/app/components/navigation/use-shortcut-slot-count"

it.each([[0, 0], [77, 0], [78, 1], [122, 2], [254, 5], [474, 10]])(
  "fits %s available pixels into %s complete rows", (height, expected) => {
    expect(calculateShortcutSlots(height, 38)).toBe(expected)
  },
)

it("reserves the smaller separator when overview is absent", () => {
  expect(calculateShortcutSlots(105, 22)).toBe(1)
  expect(calculateShortcutSlots(106, 22)).toBe(2)
})

function Fixture({ isCollapsed = false, isMobile = false }: { isCollapsed?: boolean; isMobile?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const slots = useShortcutSlotCount(ref, 38, isCollapsed, isMobile)
  return <div data-testid="drawer">
    <header />
    <div data-sidebar-shortcut-viewport>
      <div data-sidebar-shortcut-content style={{ paddingBottom: 20 }}>
        <div><div ref={ref}><output>{slots}</output></div></div>
      </div>
    </div>
    <footer />
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

it("fits mobile rows to the drawer, not the growing shortcut section, and remeasures on resize", () => {
  let resized = () => {}
  const originalObserver = global.ResizeObserver
  const observe = jest.fn()
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resized = () => callback([], this) }
    observe = observe
    unobserve() {}
    disconnect() {}
  }
  try {
    const { container } = render(<Fixture isMobile />)
    const drawer = screen.getByTestId("drawer")
    const viewport = container.querySelector("[data-sidebar-shortcut-viewport]")!
    const shortcuts = screen.getByRole("status").parentElement!
    const footer = screen.getByRole("contentinfo")
    let drawerHeight = 600
    let footerHeight = 140
    Object.defineProperty(drawer, "clientHeight", { get: () => drawerHeight })
    Object.defineProperty(viewport, "clientHeight", { value: 1000 })
    jest.spyOn(footer, "getBoundingClientRect").mockImplementation(() => ({ height: footerHeight }) as DOMRect)
    jest.spyOn(screen.getByRole("banner"), "getBoundingClientRect").mockReturnValue({ height: 130 } as DOMRect)
    jest.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 130 } as DOMRect)
    jest.spyOn(shortcuts, "getBoundingClientRect").mockReturnValue({ top: 240 } as DOMRect)
    expect(observe).toHaveBeenCalledWith(drawer)
    expect(observe).toHaveBeenCalledWith(footer)
    expect(observe).not.toHaveBeenCalledWith(viewport)
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent(/^3$/)
    drawerHeight = 820
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent(/^8$/)
    footerHeight = 184
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent(/^7$/)
    drawerHeight = 0
    act(() => resized())
    expect(screen.getByRole("status")).toHaveTextContent(/^7$/)
  } finally { global.ResizeObserver = originalObserver }
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