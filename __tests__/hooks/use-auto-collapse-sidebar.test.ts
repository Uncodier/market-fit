import { act, renderHook } from "@testing-library/react"
import {
  INNER_SIDEBAR_COLLAPSE_BREAKPOINT,
  MOBILE_BREAKPOINT,
  shouldCollapseInnerSidebar,
  useAutoCollapseSidebar,
} from "@/app/hooks/use-auto-collapse-sidebar"

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  })
}

describe("shouldCollapseInnerSidebar", () => {
  it("stays expanded on mobile", () => {
    expect(shouldCollapseInnerSidebar(MOBILE_BREAKPOINT - 1)).toBe(false)
  })

  it("collapses on compact desktop", () => {
    expect(shouldCollapseInnerSidebar(MOBILE_BREAKPOINT)).toBe(true)
    expect(shouldCollapseInnerSidebar(INNER_SIDEBAR_COLLAPSE_BREAKPOINT - 1)).toBe(true)
  })

  it("stays expanded on large desktop", () => {
    expect(shouldCollapseInnerSidebar(INNER_SIDEBAR_COLLAPSE_BREAKPOINT)).toBe(false)
    expect(shouldCollapseInnerSidebar(1600)).toBe(false)
  })
})

describe("useAutoCollapseSidebar", () => {
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    setViewport(originalInnerWidth)
  })

  it("collapses on mount when the viewport is compact desktop", () => {
    setViewport(1100)
    const { result } = renderHook(() => useAutoCollapseSidebar())
    expect(result.current[0]).toBe(true)
  })

  it("stays expanded on mount when the viewport is large", () => {
    setViewport(1440)
    const { result } = renderHook(() => useAutoCollapseSidebar())
    expect(result.current[0]).toBe(false)
  })

  it("stays expanded on mount when the viewport is mobile", () => {
    setViewport(390)
    const { result } = renderHook(() => useAutoCollapseSidebar())
    expect(result.current[0]).toBe(false)
  })

  it("collapses when resizing from large desktop into the compact range", () => {
    setViewport(1440)
    const { result } = renderHook(() => useAutoCollapseSidebar())
    expect(result.current[0]).toBe(false)

    act(() => {
      setViewport(1100)
      window.dispatchEvent(new Event("resize"))
    })

    expect(result.current[0]).toBe(true)
  })

  it("keeps a manual expand after auto-collapse", () => {
    setViewport(1100)
    const { result } = renderHook(() => useAutoCollapseSidebar())
    expect(result.current[0]).toBe(true)

    act(() => {
      result.current[1](false)
    })

    expect(result.current[0]).toBe(false)

    act(() => {
      setViewport(1090)
      window.dispatchEvent(new Event("resize"))
    })

    expect(result.current[0]).toBe(false)
  })
})
