import { fireEvent, render, screen } from "@testing-library/react"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import { Tabs } from "@/app/components/ui/tabs"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ResponsiveTabsList", () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
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

    expect(onPin).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onTabChange).not.toHaveBeenCalled()
  })
})
