import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { ShopPendingGrid } from "@/app/shop/[siteSlug]/ShopPendingGrid"

class TestIntersectionObserver implements IntersectionObserver {
  static instances: TestIntersectionObserver[] = []
  readonly root = null
  readonly rootMargin: string
  readonly thresholds = [0]
  readonly observe = jest.fn()
  readonly unobserve = jest.fn()
  readonly disconnect = jest.fn()
  readonly takeRecords = jest.fn(() => [])

  constructor(private readonly callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.rootMargin = options?.rootMargin || "0px"
    TestIntersectionObserver.instances.push(this)
  }

  emit(targets: Element[], near: boolean) {
    this.callback(targets.map((target) => ({
      target, isIntersecting: near, intersectionRatio: near ? 1 : 0,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(), rootBounds: null, time: 0,
    })), this)
  }
}

class TestResizeObserver implements ResizeObserver {
  static instances: TestResizeObserver[] = []
  readonly observe = jest.fn()
  readonly unobserve = jest.fn()
  readonly disconnect = jest.fn()

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this)
  }

  emit() { this.callback([], this) }
}

const originalObservers = ["IntersectionObserver", "ResizeObserver"].map((name) => ({
  name, descriptor: Object.getOwnPropertyDescriptor(window, name),
}))
const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let columns = 4
let gap = 24
let top = 0
let height = 404976

function flushFrame() {
  act(() => {
    const scheduled = [...frames.values()]
    frames.clear()
    scheduled.forEach((callback) => callback(0))
  })
}

function observer() { return TestIntersectionObserver.instances[0] }
function spacer(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-shop-pending-space]")!
}
function partials(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-shop-partial-slot]")]
}
function skeletons(container: Element) { return container.querySelectorAll("[data-shop-placeholder]") }
function intersect(targets: Element[], near = true) {
  act(() => { observer().emit(targets, near) })
}
function renderGrid(loadedCount = 0, pendingCount = 5000, compactMobile = true) {
  return render(<section><ShopPendingGrid {...{ loadedCount, pendingCount, compactMobile }} /></section>)
}
function setGeometry(loaded: number, pending: number, nextColumns: number, nextGap = 24) {
  columns = nextColumns
  gap = nextGap
  const remainder = loaded % columns
  const partial = remainder ? Math.min(pending, columns - remainder) : 0
  const rows = Math.ceil((pending - partial) / columns)
  height = Math.max(0, rows * (300 + gap) - gap)
}

describe("ShopPendingGrid viewport skeletons", () => {
  beforeEach(() => {
    TestIntersectionObserver.instances = []
    TestResizeObserver.instances = []
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, writable: true, value: TestIntersectionObserver })
    Object.defineProperty(window, "ResizeObserver", { configurable: true, writable: true, value: TestResizeObserver })
    frames.clear()
    nextFrame = 0
    top = 0
    setGeometry(0, 5000, 4)
    jest.replaceProperty(window, "innerHeight", 600)
    // jsdom does not resolve media queries or container-relative CSS geometry.
    jest.spyOn(window, "getComputedStyle").mockImplementation((element) => ({
      getPropertyValue: (name: string) => name === "--shop-columns" ? String(columns) : (element as HTMLElement).style.getPropertyValue(name),
      rowGap: `${gap}px`,
    }) as CSSStyleDeclaration)
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      top, height, bottom: top + height, left: 0, right: 1000, width: 1000, x: 0, y: top,
      toJSON: () => ({}),
    }))
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id) })
  })

  afterEach(() => {
    cleanup()
    expect(frames.size).toBe(0)
    jest.restoreAllMocks()
    for (const { name, descriptor } of originalObservers) {
      if (descriptor) Object.defineProperty(window, name, descriptor)
      else Reflect.deleteProperty(window, name)
    }
  })

  it("reserves 5000 pending cards with O(1) empty nodes before any intersection", () => {
    const add = jest.spyOn(window, "addEventListener")
    const { container, rerender } = renderGrid()
    const region = spacer(container)
    expect(region).toHaveAttribute("data-shop-pending-space", "5000")
    expect(region).toHaveAttribute("aria-hidden", "true")
    expect(region.style.getPropertyValue("--shop-rows-1")).toBe("5000")
    expect(region.style.getPropertyValue("--shop-rows-2")).toBe("2500")
    expect(region.style.getPropertyValue("--shop-rows-3")).toBe("1667")
    expect(region.style.getPropertyValue("--shop-rows-4")).toBe("1250")
    expect(partials(container)).toHaveLength(0)
    expect(container.querySelectorAll("*")).toHaveLength(2)
    expect(skeletons(container)).toHaveLength(0)
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0)
    expect(observer().observe).toHaveBeenCalledTimes(1)
    expect(observer().rootMargin).toBe("400px 0px")
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(add.mock.calls.filter(([type]) => type === "scroll" || type === "resize")).toHaveLength(0)

    rerender(<section><ShopPendingGrid loadedCount={0} pendingCount={500000} compactMobile /></section>)
    expect(spacer(container)).toBe(region)
    expect(region).toHaveAttribute("data-shop-pending-space", "500000")
    expect(container.querySelectorAll("*")).toHaveLength(2)
    expect(skeletons(container)).toHaveLength(0)
  })

  it.each([
    ["regular mobile", 1, 24, false],
    ["compact mobile", 2, 24, true],
    ["regular sm", 2, 24, false],
    ["regular md", 2, 32, false],
    ["compact md", 2, 24, true],
    ["regular lg", 3, 32, false],
    ["compact lg", 3, 32, true],
    ["regular xl", 4, 32, false],
    ["compact xl", 4, 32, true],
  ])("mounts only measured nearby rows at %s", (_breakpoint, nextColumns, nextGap, compact) => {
    setGeometry(0, 5000, nextColumns, nextGap)
    const { container } = renderGrid(0, 5000, compact)
    const region = spacer(container)
    intersect([region])
    expect(skeletons(container)).toHaveLength(0)
    expect(frames.size).toBe(1)
    flushFrame()
    expect(skeletons(region)).toHaveLength(4 * nextColumns)
    expect(region.firstElementChild).toHaveStyle({ top: "0px" })
    expect(region.firstElementChild).toHaveClass(compact ? "grid-cols-2" : "grid-cols-1")
    // Stable Shop skeletons reserve the same bounded text slots as loaded cards.
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(9 * 4 * nextColumns)
    expect(container.querySelectorAll(".aspect-square")).toHaveLength(compact ? 4 * nextColumns : 0)
  })

  it("scrolls a bounded keyed window instead of retaining the previous detailed cards", () => {
    const { container } = renderGrid()
    const region = spacer(container)
    intersect([region])
    flushFrame()
    const firstCards = [...skeletons(region)]
    expect(firstCards).toHaveLength(16)
    top = -3240
    fireEvent.scroll(window)
    fireEvent.scroll(window)
    fireEvent.resize(window)
    expect(frames.size).toBe(1)
    flushFrame()
    expect(skeletons(region)).toHaveLength(24)
    expect(region.firstElementChild).toHaveStyle({ top: "2592px" })
    expect(firstCards.every((card) => !card.isConnected)).toBe(true)
    const middleCards = [...skeletons(region)]
    fireEvent.scroll(window)
    flushFrame()
    expect([...skeletons(region)]).toEqual(middleCards)
    expect(spacer(container)).toBe(region)
  })

  it("drops detailed cards on leave but preserves every reserved node and inline style", () => {
    const remove = jest.spyOn(window, "removeEventListener")
    const { container } = renderGrid(1)
    const region = spacer(container)
    const slots = partials(container)
    const reserved = [...slots, region]
    const styles = reserved.map((element) => element.getAttribute("style"))
    intersect(reserved)
    flushFrame()
    expect(skeletons(region)).toHaveLength(16)
    expect(slots.every((slot) => skeletons(slot).length === 1)).toBe(true)
    fireEvent.scroll(window)
    const queued = nextFrame
    intersect(reserved, false)
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(queued)
    expect(TestResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function))
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function))
    expect(skeletons(container)).toHaveLength(0)
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0)
    expect([...partials(container), spacer(container)]).toEqual(reserved)
    expect(reserved.map((element) => element.getAttribute("style"))).toEqual(styles)
    fireEvent.scroll(window)
    fireEvent.resize(window)
    expect(frames.size).toBe(0)

    intersect([region])
    flushFrame()
    expect(skeletons(region)).toHaveLength(16)
    expect(TestResizeObserver.instances).toHaveLength(2)
  })

  it("cleans up shared intersection targets, scroll/resize listeners, resize observation and queued frames on unmount", () => {
    const add = jest.spyOn(window, "addEventListener")
    const remove = jest.spyOn(window, "removeEventListener")
    const { container, unmount } = renderGrid(1)
    const targets = [...partials(container), spacer(container)]
    const io = observer()
    intersect([spacer(container)])
    intersect([spacer(container)])
    const scroll = add.mock.calls.filter(([type]) => type === "scroll")
    const resize = add.mock.calls.filter(([type]) => type === "resize")
    expect(scroll).toHaveLength(1)
    expect(resize).toHaveLength(1)
    expect(scroll[0][2]).toEqual({ passive: true })
    const ro = TestResizeObserver.instances[0]
    expect(ro.observe).toHaveBeenCalledWith(spacer(container))
    const queued = nextFrame
    unmount()
    expect(io.unobserve).toHaveBeenCalledTimes(targets.length)
    expect(io.unobserve.mock.calls.map(([target]) => target)).toEqual(expect.arrayContaining(targets))
    expect(io.disconnect).toHaveBeenCalledTimes(1)
    expect(ro.disconnect).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith("scroll", scroll[0][1])
    expect(remove).toHaveBeenCalledWith("resize", resize[0][1])
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(queued)
    fireEvent.scroll(window)
    fireEvent.resize(window)
    intersect(targets)
    expect(frames.size).toBe(0)
  })

  it("shares one IntersectionObserver across grids and disconnects only after the last instance leaves", () => {
    const first = renderGrid(1)
    const second = renderGrid(1)
    const io = observer()
    expect(TestIntersectionObserver.instances).toHaveLength(1)
    expect(io.observe).toHaveBeenCalledTimes(8)
    intersect([spacer(first.container)])
    flushFrame()
    expect(skeletons(first.container)).toHaveLength(16)
    expect(skeletons(second.container)).toHaveLength(0)
    const removedRegion = spacer(first.container)
    first.unmount()
    expect(io.unobserve).toHaveBeenCalledTimes(4)
    expect(io.disconnect).not.toHaveBeenCalled()
    intersect([removedRegion, spacer(second.container)])
    flushFrame()
    expect(skeletons(second.container)).toHaveLength(16)
    second.unmount()
    expect(io.unobserve).toHaveBeenCalledTimes(8)
    expect(io.disconnect).toHaveBeenCalledTimes(1)
    const third = renderGrid()
    expect(TestIntersectionObserver.instances).toHaveLength(2)
    third.unmount()
  })

  it.each([
    [1, 1, 7, 0, 7],
    [2, 1, 7, 1, 6],
    [3, 1, 7, 2, 5],
    [3, 2, 7, 1, 6],
    [4, 1, 7, 3, 4],
    [4, 2, 7, 2, 5],
    [4, 3, 7, 1, 6],
    [4, 1, 2, 2, 0],
    [3, 3, 5, 0, 5],
  ])("splits columns=%i loaded=%i pending=%i into %i partial and %i remaining skeletons", (
    nextColumns, loaded, pending, partialCount, remaining,
  ) => {
    setGeometry(loaded, pending, nextColumns)
    jest.replaceProperty(window, "innerHeight", 3000)
    const { container } = renderGrid(loaded, pending)
    const region = spacer(container)
    const visibleSlots = partials(container).filter((slot) => slot.style.getPropertyValue(`--shop-display-${nextColumns}`) === "block")
    expect(visibleSlots).toHaveLength(partialCount)
    expect(region.style.getPropertyValue(`--shop-display-${nextColumns}`)).toBe(remaining ? "block" : "none")
    intersect([...visibleSlots, region])
    flushFrame()
    expect(skeletons(region)).toHaveLength(remaining)
    expect(skeletons(container)).toHaveLength(pending)
    expect(partials(container).filter((slot) => skeletons(slot).length > 0)).toHaveLength(partialCount)
  })

  it("clamps the final nondivisible row to actual remaining pending cards", () => {
    setGeometry(1, 5000, 4)
    top = -404400
    const { container } = renderGrid(1, 5000)
    const region = spacer(container)
    intersect([region])
    flushFrame()
    // 4997 row cards: start row 1246 => 4984 skipped, leaving exactly 13.
    expect(skeletons(region)).toHaveLength(13)
    expect(region.firstElementChild).toHaveStyle({ top: "403704px" })
    expect(region).toHaveAttribute("data-shop-pending-space", "5000")
  })

  it.each([0, 3])("never keeps more detailed cards than pending=%i after a count update", (pending) => {
    const { container, rerender } = renderGrid()
    const region = spacer(container)
    intersect([region])
    flushFrame()
    expect(skeletons(region)).toHaveLength(16)
    setGeometry(0, pending, 4)
    rerender(<section><ShopPendingGrid loadedCount={0} pendingCount={pending} compactMobile /></section>)
    expect(spacer(container)).toBe(region)
    expect(region).toHaveAttribute("data-shop-pending-space", String(pending))
    expect(skeletons(region).length).toBeLessThanOrEqual(pending)
    intersect([region])
    flushFrame()
    expect(skeletons(region)).toHaveLength(pending)
  })

  it("remeasures the active window on resize and container resize without duplicating listeners", () => {
    const add = jest.spyOn(window, "addEventListener")
    const { container } = renderGrid()
    const region = spacer(container)
    const reservedStyle = region.getAttribute("style")
    intersect([region])
    flushFrame()
    setGeometry(0, 5000, 2, 32)
    fireEvent.resize(window)
    flushFrame()
    expect(skeletons(region)).toHaveLength(8)
    setGeometry(0, 5000, 3, 32)
    act(() => { TestResizeObserver.instances[0].emit() })
    flushFrame()
    expect(skeletons(region)).toHaveLength(12)
    expect(region.getAttribute("style")).toBe(reservedStyle)
    expect(add.mock.calls.filter(([type]) => type === "scroll" || type === "resize")).toHaveLength(2)
  })

  it("still renders an empty reserved spacer without IntersectionObserver support", () => {
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, writable: true, value: undefined })
    const { container } = renderGrid(1)
    expect(TestIntersectionObserver.instances).toHaveLength(0)
    expect(spacer(container)).toHaveAttribute("data-shop-pending-space", "5000")
    expect(spacer(container).style.getPropertyValue("--shop-rows-4")).toBe("1250")
    expect(partials(container)).toHaveLength(3)
    expect(skeletons(container)).toHaveLength(0)
    expect(container.querySelectorAll("*")).toHaveLength(5)
    fireEvent.scroll(window)
    fireEvent.resize(window)
    expect(frames.size).toBe(0)
  })

  it("uses scroll/resize measurement even without ResizeObserver support", () => {
    Object.defineProperty(window, "ResizeObserver", { configurable: true, writable: true, value: undefined })
    const { container } = renderGrid()
    intersect([spacer(container)])
    flushFrame()
    expect(skeletons(container)).toHaveLength(16)
    expect(TestResizeObserver.instances).toHaveLength(0)
    top = -3240
    fireEvent.scroll(window)
    flushFrame()
    expect(skeletons(container)).toHaveLength(24)
  })
})