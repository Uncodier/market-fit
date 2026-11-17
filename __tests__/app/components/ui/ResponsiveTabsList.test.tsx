import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import { Tabs } from "@/app/components/ui/tabs"

class ResizeObserverMock {
  static callbacks: ResizeObserverCallback[] = []
  constructor(callback: ResizeObserverCallback) {
    ResizeObserverMock.callbacks.push(callback)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ResponsiveTabsList", () => {
  const originalResizeObserver = global.ResizeObserver
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
  })

  afterAll(() => { global.ResizeObserver = originalResizeObserver })
  afterEach(() => {
    jest.restoreAllMocks()
    ResizeObserverMock.callbacks = []
  })

  function mockLayout(initialWidth: number) {
    let width = initialWidth
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width)
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const measuredWidth = this.hasAttribute("data-overflow-measure") ? 40 :
        this.textContent?.includes("Long") ? 180 : 50
      return { width: measuredWidth, height: 32, x: 0, y: 0, top: 0, left: 0,
        right: measuredWidth, bottom: 32, toJSON: () => ({}) }
    })
    return (nextWidth: number) => {
      width = nextWidth
      act(() => ResizeObserverMock.callbacks.forEach(callback => callback([], {} as ResizeObserver)))
    }
  }

  const basicTabs = [
    { value: "first", label: "First" },
    { value: "second", label: "Second" },
    { value: "last", label: "Last" },
  ]

  it("reclaims space when the allocated parent width grows without a window resize", () => {
    const resize = mockLayout(140)
    const preferredWidth = jest.fn()
    render(<Tabs value="first"><ResponsiveTabsList tabs={basicTabs} activeTab="first"
      onTabChange={jest.fn()} onPreferredWidthChange={preferredWidth} /></Tabs>)
    expect(screen.getAllByRole("tab")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "More options" })).toHaveTextContent("1")
    expect(preferredWidth).toHaveBeenCalledWith(150)
    resize(150)
    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.queryByRole("button", { name: "More options" })).not.toBeInTheDocument()
    resize(90)
    expect(screen.getAllByRole("tab")).toHaveLength(1)
  })

  it("rechecks changed labels and the active tab width", () => {
    mockLayout(220)
    const onTabChange = jest.fn()
    const tabs = [...basicTabs.slice(0, 2), { value: "last", label: "Long last label" }]
    const view = render(<Tabs value="first"><ResponsiveTabsList tabs={tabs} activeTab="first"
      onTabChange={onTabChange} /></Tabs>)
    expect(screen.getAllByRole("tab")).toHaveLength(2)
    view.rerender(<Tabs value="last"><ResponsiveTabsList tabs={tabs} activeTab="last"
      onTabChange={onTabChange} /></Tabs>)
    expect(screen.getAllByRole("tab")).toHaveLength(1)
    expect(screen.getByRole("tab", { name: "Long last label" })).toHaveAttribute("data-state", "active")
    view.rerender(<Tabs value="last"><ResponsiveTabsList tabs={basicTabs} activeTab="last"
      onTabChange={onTabChange} /></Tabs>)
    expect(screen.getAllByRole("tab")).toHaveLength(3)
  })

  it("keeps all choices accessible when only the overflow control fits", () => {
    mockLayout(60)
    const onTabChange = jest.fn()
    render(<Tabs value="last"><ResponsiveTabsList tabs={[
      { value: "last", label: "Long last label" },
    ]} activeTab="last" onTabChange={onTabChange} /></Tabs>)
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("button", { name: "More options" }), { key: "Enter" })
    const menu = screen.getByRole("menu")
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Long last label" }))
    expect(onTabChange).toHaveBeenCalledWith("last")
  })

  it("runs tab actions without selecting the tab", () => {
    const onTabChange = jest.fn()
    const onPin = jest.fn()
    const onClose = jest.fn()

    render(
      <Tabs value="preview" onValueChange={onTabChange}>
        <ResponsiveTabsList
          activeTab="preview"
          onTabChange={onTabChange}
          tabs={[
            { value: "preview", label: "Preview" },
            {
              value: "artifact-people",
              label: "People",
              leadingAction: {
                label: "Pin People to navigation",
                icon: <span>+</span>,
                onSelect: onPin,
              },
              trailingAction: {
                label: "Close People artifact",
                icon: <span>x</span>,
                onSelect: onClose,
              },
            },
          ]}
        />
      </Tabs>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Pin People to navigation" }))
    fireEvent.click(screen.getByRole("button", { name: "Close People artifact" }))

    expect(screen.getByRole("tab", { name: "People" }).parentElement).toHaveClass(
      "inline-flex",
      "items-center",
      "self-center",
      "rounded-[inherit]",
    )
    expect(screen.getByRole("tab", { name: "Preview" }).parentElement).not.toHaveClass(
      "group",
    )
    expect(onPin).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onTabChange).not.toHaveBeenCalled()
  })
})
