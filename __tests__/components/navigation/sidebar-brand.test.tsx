import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { SidebarBrand } from "@/app/components/navigation/SidebarBrand"

jest.mock("@/app/components/navigation/NavigationLink", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react")
  return {
    NavigationLink: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
      function NavigationLink(props, ref) { return <a ref={ref} {...props} /> },
    ),
  }
})

const originalMatchMedia = window.matchMedia
const originalAnimate = Object.getOwnPropertyDescriptor(SVGElement.prototype, "animate")
const originalTimeline = Object.getOwnPropertyDescriptor(document, "timeline")
const animate = jest.fn()
const preference = {
  matches: false,
  media: "(prefers-reduced-motion: reduce)",
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}
type TestAnimation = { cancel: jest.Mock; playState: AnimationPlayState; startTime: number | null }
let animation: TestAnimation
let leverAnimation: TestAnimation

function renderBrand(isCollapsed = true) {
  const view = render(<SidebarBrand isCollapsed={isCollapsed} />, {
    wrapper: ({ children }) => <div data-collapsed>{children}</div>,
  })
  const link = screen.getByRole("link", { name: "Makinari Logo" })
  const sidebar = link.closest("[data-collapsed]")!
  return { ...view, link, sidebar }
}

function endTransition(element: Element, propertyName: string) {
  // jsdom does not expose TransitionEvent or its propertyName constructor option.
  const event = new Event("transitionend", { bubbles: true })
  Object.defineProperty(event, "propertyName", { value: propertyName })
  fireEvent(element, event)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  preference.matches = false
  animation = { cancel: jest.fn(), playState: "running", startTime: null }
  leverAnimation = { cancel: jest.fn(), playState: "running", startTime: null }
  animate.mockImplementation(function (this: SVGElement) {
    const current = this.tagName.toLowerCase() === "path" ? leverAnimation : animation
    current.playState = "running"
    return current
  })
  window.matchMedia = jest.fn().mockReturnValue(preference)
  Object.defineProperty(document, "timeline", { configurable: true, value: { currentTime: 1234 } })
  Object.defineProperty(SVGElement.prototype, "animate", { configurable: true, value: animate })
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  window.matchMedia = originalMatchMedia
  if (originalAnimate) Object.defineProperty(SVGElement.prototype, "animate", originalAnimate)
  else Reflect.deleteProperty(SVGElement.prototype, "animate")
  if (originalTimeline) Object.defineProperty(document, "timeline", originalTimeline)
  else Reflect.deleteProperty(document, "timeline")
})

describe("SidebarBrand", () => {
  it("preserves the collapsed mark's dimensions, geometry, themes and navigation", () => {
    const { link } = renderBrand()
    const mark = screen.getByRole("img", { name: "Makinari Logo" })
    expect(link).toHaveAttribute("href", "/robots")
    expect(link).toHaveClass("h-16", "px-3")
    expect(mark.tagName.toLowerCase()).toBe("svg")
    expect(mark).toHaveAttribute("viewBox", "0 0 1281 1488")
    expect(mark).toHaveAttribute("fill", "currentColor")
    expect(mark).toHaveClass("h-6", "w-6", "text-black", "dark:text-white")
    expect(mark.querySelectorAll("path")).toHaveLength(2)
    expect(mark.querySelector("circle")).toHaveAttribute("cx", "159.5")
    expect(mark.querySelector("circle")).toHaveAttribute("cy", "902.957")
    expect(mark.querySelector("circle")).toHaveAttribute("r", "159.5")
  })

  it("keeps the expanded wordmark static", () => {
    const { link } = renderBrand(false)
    const wordmark = screen.getByRole("img", { name: "Makinari Logo" })
    expect(wordmark).toHaveAttribute("src", "/images/combination_mark.png")
    expect(wordmark).toHaveClass("h-5", "object-contain", "dark:invert")
    expect(link).toHaveClass("px-6")
    expect(link.querySelector("svg")).toBeNull()
    fireEvent.mouseEnter(link)
    fireEvent.focus(link)
    expect(animate).not.toHaveBeenCalled()
  })

  it("does not launch automatically when already collapsed on mount", () => {
    renderBrand()
    expect(animate).not.toHaveBeenCalled()
  })

  it("launches the ball after wind-up and lands at the exact original position", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)

    expect(animate).toHaveBeenCalledTimes(2)
    expect(animate.mock.contexts[1]).toBe(link.querySelector("circle"))
    expect(animate).toHaveBeenNthCalledWith(2, [
      { transform: "translateY(0)", offset: 0 },
      { transform: "translateY(0)", offset: 0.12, easing: "cubic-bezier(0.33, 0.67, 0.67, 1)" },
      { transform: "translateY(-640px)", offset: 0.52, easing: "cubic-bezier(0.33, 0, 0.67, 0.33)" },
      { transform: "translateY(0)", offset: 1 },
    ], { duration: 820, iterations: 1 })
    expect(link.querySelector("circle")).toHaveAttribute("cy", "902.957")
  })

  it("winds up and holds the raised lever until the ball starts falling", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)

    expect(animate.mock.contexts[0]).toBe(link.querySelector("path"))
    expect(animate).toHaveBeenNthCalledWith(1, [
      { transform: "rotate(0deg)", offset: 0, easing: "ease-out" },
      { transform: "rotate(-12deg)", offset: 0.12, easing: "cubic-bezier(0.2, 0, 0.2, 1)" },
      { transform: "rotate(26deg)", offset: 0.24 },
      { transform: "rotate(26deg)", offset: 0.52, easing: "cubic-bezier(0.33, 0, 0.67, 0.33)" },
      { transform: "rotate(0deg)", offset: 1 },
    ], { duration: 820, iterations: 1 })
    expect(animate.mock.contexts).not.toContain(link.querySelectorAll("path")[1])
    expect(leverAnimation.startTime).toBe(1234)
    expect(leverAnimation.startTime).toBe(animation.startTime)
  })

  it("lowers the lever and ball together with the same descent timing and easing", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)
    const leverFrames = animate.mock.calls[0][0] as Keyframe[]
    const ballFrames = animate.mock.calls[1][0] as Keyframe[]
    const leverDescent = leverFrames.at(-2)!
    const ballDescent = ballFrames.at(-2)!

    expect(leverDescent.offset).toBe(0.52)
    expect(leverDescent.offset).toBe(ballDescent.offset)
    expect(leverDescent.easing).toBe(ballDescent.easing)
    expect(leverFrames.at(-1)?.offset).toBe(1)
    expect(ballFrames.at(-1)?.offset).toBe(1)
    expect(animate.mock.calls[0][1]).toEqual(animate.mock.calls[1][1])
  })

  it("completes the fall even when the pointer leaves mid-flight", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)
    fireEvent.mouseLeave(link)
    expect(animation.cancel).not.toHaveBeenCalled()
    expect(leverAnimation.cancel).not.toHaveBeenCalled()
  })

  it("also launches for keyboard focus", () => {
    const { link } = renderBrand()
    fireEvent.focus(link)
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it("does not restart mid-flight when hover and focus overlap", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)
    fireEvent.focus(link)
    fireEvent.mouseLeave(link)
    fireEvent.mouseEnter(link)
    expect(animate).toHaveBeenCalledTimes(2)
    expect(animation.cancel).not.toHaveBeenCalled()
    expect(leverAnimation.cancel).not.toHaveBeenCalled()
  })

  it("can launch again on a fresh hover after landing", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)
    animation.playState = "finished"
    leverAnimation.playState = "finished"
    fireEvent.mouseLeave(link)
    fireEvent.mouseEnter(link)
    expect(animate).toHaveBeenCalledTimes(4)
    expect(animation.cancel).toHaveBeenCalledTimes(1)
    expect(leverAnimation.cancel).toHaveBeenCalledTimes(1)
  })

  it("waits for both parts to finish before another launch", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)
    animation.playState = "finished"
    fireEvent.mouseLeave(link)
    fireEvent.mouseEnter(link)
    expect(animate).toHaveBeenCalledTimes(2)
    expect(leverAnimation.cancel).not.toHaveBeenCalled()
  })

  it("waits for the sidebar width transition, then launches once", () => {
    const { rerender, sidebar } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    expect(animate).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(300))
    expect(animate).not.toHaveBeenCalled()
    endTransition(sidebar, "width")
    expect(animate).toHaveBeenCalledTimes(2)
    rerender(<SidebarBrand isCollapsed />)
    endTransition(sidebar, "width")
    act(() => jest.advanceTimersByTime(350))
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it("uses a delayed fallback if the width transition does not emit transitionend", () => {
    const { rerender } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    act(() => jest.advanceTimersByTime(349))
    expect(animate).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it("does not launch for a child transition or a different sidebar property", () => {
    const { rerender, sidebar, link } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    endTransition(link, "width")
    endTransition(sidebar, "transform")
    expect(animate).not.toHaveBeenCalled()
    endTransition(sidebar, "width")
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it("does not let hover or focus launch before collapse completes", () => {
    const { rerender, sidebar, link } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    fireEvent.mouseEnter(link)
    fireEvent.focus(link)
    expect(animate).not.toHaveBeenCalled()
    endTransition(sidebar, "width")
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it("cancels a pending launch when the sidebar expands again", () => {
    const { rerender, sidebar } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    act(() => jest.advanceTimersByTime(150))
    rerender(<SidebarBrand isCollapsed={false} />)
    endTransition(sidebar, "width")
    act(() => jest.advanceTimersByTime(350))
    expect(animate).not.toHaveBeenCalled()
  })

  it("cleans up the pending timer and transition listener on unmount", () => {
    const { rerender, sidebar, unmount } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    unmount()
    endTransition(sidebar, "width")
    act(() => jest.advanceTimersByTime(350))
    expect(animate).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  it("cancels a pending launch when reduced motion becomes enabled", () => {
    const { rerender, sidebar } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    preference.matches = true
    act(preference.addEventListener.mock.calls[0][1] as () => void)
    preference.matches = false
    endTransition(sidebar, "width")
    act(() => jest.advanceTimersByTime(350))
    expect(animate).not.toHaveBeenCalled()
  })

  it("cancels when expanding and can launch on the next collapse", () => {
    const { link, rerender } = renderBrand()
    fireEvent.mouseEnter(link)
    rerender(<SidebarBrand isCollapsed={false} />)
    expect(animation.cancel).toHaveBeenCalledTimes(1)
    expect(leverAnimation.cancel).toHaveBeenCalledTimes(1)
    rerender(<SidebarBrand isCollapsed />)
    act(() => jest.advanceTimersByTime(350))
    expect(animate).toHaveBeenCalledTimes(4)
  })

  it("disables hover, focus and collapse animation for reduced motion", () => {
    preference.matches = true
    const { link, rerender } = renderBrand(false)
    rerender(<SidebarBrand isCollapsed />)
    fireEvent.mouseEnter(link)
    fireEvent.focus(link)
    act(() => jest.advanceTimersByTime(350))
    expect(window.matchMedia).toHaveBeenCalledWith(preference.media)
    expect(animate).not.toHaveBeenCalled()
  })

  it("cancels an in-flight animation when reduced motion becomes enabled", () => {
    const { link } = renderBrand()
    fireEvent.mouseEnter(link)
    preference.matches = true
    const handleChange = preference.addEventListener.mock.calls[0][1] as () => void
    act(handleChange)
    expect(animation.cancel).toHaveBeenCalledTimes(1)
    expect(leverAnimation.cancel).toHaveBeenCalledTimes(1)
    fireEvent.mouseLeave(link)
    fireEvent.mouseEnter(link)
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it("cleans up animation and preference listeners on unmount", () => {
    const { link, unmount } = renderBrand()
    fireEvent.mouseEnter(link)
    const handleChange = preference.addEventListener.mock.calls[0][1]
    unmount()
    expect(animation.cancel).toHaveBeenCalledTimes(1)
    expect(leverAnimation.cancel).toHaveBeenCalledTimes(1)
    expect(preference.removeEventListener).toHaveBeenCalledWith("change", handleChange)
  })

  it("keeps a static mark when the browser does not support Web Animations", () => {
    Reflect.deleteProperty(SVGElement.prototype, "animate")
    const { link, rerender } = renderBrand(false)
    expect(() => rerender(<SidebarBrand isCollapsed />)).not.toThrow()
    expect(() => fireEvent.mouseEnter(link)).not.toThrow()
    expect(() => act(() => jest.advanceTimersByTime(350))).not.toThrow()
    expect(animate).not.toHaveBeenCalled()
  })
})